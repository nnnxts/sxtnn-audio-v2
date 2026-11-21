import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import archiver from 'archiver';
import crypto from 'node:crypto';
import multer from 'multer';
import db from '../db.js';
import { CANVAS_MAX_BYTES, CANVAS_MAX_SECONDS, GENRES, TMP_DIR, UPLOADS_DIR, VISIBILITIES } from '../config.js';
import { requireArtist, signArtistToken, signBackupToken, verifyToken } from '../auth.js';
import { handleUpload, readDuration, readMediaDuration } from '../upload.js';
import { RestoreError, restoreFromZip } from '../restore.js';
import { ADMIN_KEY, IS_ONLINE, accessRequired, adminKeyOk, checkCode } from '../access.js';
import { mediaTokenFor, withToken } from '../visibility.js';
import { RELEASE_SELECT, RELEASE_ORDER, artistDTO, getOrCreateArtist, hydrateReleases } from '../queries.js';
import {
  cleanName,
  cleanupUploadedFiles,
  deleteOrphanFiles,
  fileToUrl,
  generateIsrc,
  isValidReleaseDate,
  parseTags,
  safeUnlink,
  todayISO,
  toBool,
  uniqueArtistSlug,
  uploadedFileUrl,
} from '../utils.js';

const router = express.Router();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendError(res, err) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error('[distro] erreur inattendue :', err);
  return res.status(500).json({ error: 'Erreur serveur inattendue.' });
}

/* ============================== Connexion artiste ============================== */

/** Dit si un code est exigé pour entrer dans l'accès artiste (aucune donnée sensible). */
router.get('/distro/access', (_req, res) => {
  res.json({ code_required: accessRequired() });
});

/** Vérifie le code d'accès (1re étape de l'écran « Accès Artiste »). */
router.post('/distro/check-code', (req, res) => {
  const result = checkCode(req, req.body?.code);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true });
});

router.post('/distro/login', (req, res) => {
  const gate = checkCode(req, req.body?.code);
  if (!gate.ok) return res.status(gate.status).json({ error: gate.error });
  const name = cleanName(req.body?.name);
  if (name.length < 1) return res.status(400).json({ error: 'Entrez votre nom d\'artiste.' });

  let artist = db.prepare('SELECT * FROM artists WHERE name = ?').get(name);
  let created = false;
  if (!artist) {
    const info = db.prepare('INSERT INTO artists (name, slug) VALUES (?, ?)').run(name, uniqueArtistSlug(name));
    artist = db.prepare('SELECT * FROM artists WHERE id = ?').get(info.lastInsertRowid);
    created = true;
  }
  res.json({ token: signArtistToken(artist.id), artist: artistDTO(artist), created });
});

router.get('/distro/me', requireArtist, (req, res) => {
  const artist = db.prepare('SELECT * FROM artists WHERE id = ?').get(req.artistId);
  if (!artist) return res.status(401).json({ error: 'Artiste introuvable.' });
  res.json({ artist: artistDTO(artist) });
});

/* ============================== Profil ============================== */

router.put('/distro/profile', requireArtist, handleUpload, (req, res) => {
  try {
    const artist = db.prepare('SELECT * FROM artists WHERE id = ?').get(req.artistId);
    if (!artist) throw new HttpError(401, 'Artiste introuvable.');
    const body = req.body || {};

    let name = artist.name;
    let slug = artist.slug;
    if (body.name !== undefined) {
      name = cleanName(body.name);
      if (!name) throw new HttpError(400, 'Le nom d\'artiste ne peut pas être vide.');
      const clash = db.prepare('SELECT id FROM artists WHERE name = ?').get(name);
      if (clash && clash.id !== artist.id) throw new HttpError(409, 'Ce nom d\'artiste existe déjà.');
      if (name.toLowerCase() !== artist.name.toLowerCase()) slug = uniqueArtistSlug(name, artist.id);
    }
    const bio = body.bio !== undefined ? String(body.bio).slice(0, 2000) : artist.bio;
    const isVerified = body.is_verified !== undefined ? (toBool(body.is_verified) ? 1 : 0) : artist.is_verified;

    const obsolete = [];
    let avatarUrl = artist.avatar_url;
    let bannerUrl = artist.banner_url;
    if (req.fileMap.avatar) {
      obsolete.push(artist.avatar_url);
      avatarUrl = fileToUrl('avatars', path.basename(req.fileMap.avatar.path));
    } else if (toBool(body.remove_avatar)) {
      obsolete.push(artist.avatar_url);
      avatarUrl = null;
    }
    if (req.fileMap.banner) {
      obsolete.push(artist.banner_url);
      bannerUrl = fileToUrl('banners', path.basename(req.fileMap.banner.path));
    } else if (toBool(body.remove_banner)) {
      obsolete.push(artist.banner_url);
      bannerUrl = null;
    }

    db.prepare('UPDATE artists SET name = ?, slug = ?, bio = ?, avatar_url = ?, banner_url = ?, is_verified = ? WHERE id = ?').run(
      name,
      slug,
      bio,
      avatarUrl,
      bannerUrl,
      isVerified,
      artist.id
    );
    deleteOrphanFiles(obsolete);
    res.json({ artist: artistDTO(db.prepare('SELECT * FROM artists WHERE id = ?').get(artist.id)) });
  } catch (err) {
    cleanupUploadedFiles(req.files);
    sendError(res, err);
  }
});

/** Suppression définitive du profil + sorties + fichiers devenus orphelins. */
router.delete('/distro/profile', requireArtist, (req, res) => {
  try {
    const artist = db.prepare('SELECT * FROM artists WHERE id = ?').get(req.artistId);
    if (!artist) throw new HttpError(404, 'Artiste introuvable.');

    const urls = [artist.avatar_url, artist.banner_url];
    const releases = db.prepare('SELECT id, cover_url, canvas_url FROM releases WHERE primary_artist_id = ?').all(artist.id);
    for (const r of releases) {
      urls.push(r.cover_url, r.canvas_url);
      for (const t of db.prepare('SELECT audio_url, canvas_url FROM tracks WHERE release_id = ?').all(r.id)) urls.push(t.audio_url, t.canvas_url);
    }
    db.prepare('DELETE FROM artists WHERE id = ?').run(artist.id); // cascade : sorties, pistes, liens, likes...
    deleteOrphanFiles(urls);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
});

/* ============================== Sorties ============================== */

router.get('/distro/releases', requireArtist, (req, res) => {
  const rows = db.prepare(`${RELEASE_SELECT} WHERE r.primary_artist_id = ? ${RELEASE_ORDER}`).all(req.artistId);
  res.json({ releases: hydrateReleases(rows) });
});

router.get('/distro/releases/:id', requireArtist, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`${RELEASE_SELECT} WHERE r.id = ? AND r.primary_artist_id = ?`).get(id, req.artistId);
  if (!row) return res.status(404).json({ error: 'Sortie introuvable.' });
  const viewer = { userId: 0, artistId: req.artistId };
  const [release] = hydrateReleases([row], viewer);
  const mediaToken = release.visibility === 'friends' ? mediaTokenFor(viewer) : null;

  const tracks = db.prepare('SELECT * FROM tracks WHERE release_id = ? ORDER BY track_number ASC, id ASC').all(id);
  const linkStmt = db.prepare(
    `SELECT ta.role, a.id AS artist_id, a.name FROM track_artists ta JOIN artists a ON a.id = ta.artist_id WHERE ta.track_id = ?`
  );
  const detailed = tracks.map((t) => {
    const links = linkStmt.all(t.id);
    return {
      id: t.id,
      track_number: t.track_number,
      title: t.title,
      audio_url: withToken(t.audio_url, mediaToken),
      canvas_url: withToken(t.canvas_url || null, mediaToken),
      duration_seconds: t.duration_seconds,
      isrc: t.isrc || '',
      is_explicit: !!t.is_explicit,
      lyrics: t.lyrics || '',
      play_count: t.play_count,
      mains: links.filter((l) => l.role === 'main' && l.artist_id !== row.primary_artist_id).map((l) => l.name),
      feats: links.filter((l) => l.role === 'feature').map((l) => l.name),
    };
  });
  res.json({ release, tracks: detailed });
});

/* ------------------------------ Validation commune ------------------------------ */

function parsePayload(req) {
  let data;
  try {
    data = JSON.parse(req.body?.data || '{}');
  } catch {
    throw new HttpError(400, 'Données de la sortie invalides.');
  }

  const title = cleanName(data.title, 150);
  if (!title) throw new HttpError(400, 'Le titre de la sortie est obligatoire.');

  const type = ['single', 'ep', 'album'].includes(data.type) ? data.type : 'single';

  let releaseDate = String(data.release_date || '').trim();
  if (!releaseDate) releaseDate = todayISO();
  if (!isValidReleaseDate(releaseDate)) {
    throw new HttpError(400, 'Date de sortie invalide. Formats acceptés : AAAA, AAAA-MM ou AAAA-MM-JJ.');
  }

  const label = cleanName(data.label, 80) || 'Indépendant';
  const primaryGenre = cleanName(data.primary_genre, 40) || 'Autre';
  let secondaryGenre = cleanName(data.secondary_genre, 40);
  if (!secondaryGenre || secondaryGenre === 'Aucun' || secondaryGenre === primaryGenre) secondaryGenre = null;

  if (!Array.isArray(data.tracks) || data.tracks.length === 0) {
    throw new HttpError(400, 'Ajoutez au moins un morceau.');
  }
  if (data.tracks.length > 80) throw new HttpError(400, '80 morceaux maximum par sortie.');

  const seenKeys = new Set();
  const tracks = data.tracks.map((t, i) => {
    const key = String(t.key ?? '');
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(key) || seenKeys.has(key)) {
      throw new HttpError(400, `Morceau n°${i + 1} : identifiant invalide.`);
    }
    seenKeys.add(key);
    const tTitle = cleanName(t.title, 150);
    if (!tTitle) throw new HttpError(400, `Morceau n°${i + 1} : le titre est obligatoire.`);
    return {
      key,
      id: t.id ? Number(t.id) : null,
      title: tTitle,
      isrc: String(t.isrc || '').trim().toUpperCase().slice(0, 20),
      mains: parseTags(t.mains),
      feats: parseTags(t.feats),
      is_explicit: toBool(t.is_explicit),
      lyrics: String(t.lyrics || '').slice(0, 20000),
      removeCanvas: toBool(t.remove_canvas),
    };
  });

  return {
    title,
    type,
    releaseDate,
    label,
    primaryGenre,
    secondaryGenre,
    isLeak: toBool(data.is_leak),
    visibility: VISIBILITIES.includes(data.visibility) ? data.visibility : undefined,
    removeCover: toBool(data.remove_cover),
    removeCanvas: toBool(data.remove_canvas),
    tracks,
  };
}

/**
 * Vérifie les vidéos « canvas » envoyées (release : champ « canvas », morceau : « canvas_<clé> »).
 * 8 secondes maximum et poids limité. Si la durée ne peut pas être lue, on accepte
 * (le formulaire du site la vérifie déjà avant l'envoi).
 */
async function validateCanvasFiles(fileMap, tracks) {
  const keys = new Set(tracks.map((t) => t.key));
  for (const [field, file] of Object.entries(fileMap)) {
    const isRelease = field === 'canvas';
    const isTrack = field.startsWith('canvas_');
    if (!isRelease && !isTrack) continue;
    if (isTrack && !keys.has(field.slice('canvas_'.length))) continue; // ignoré puis supprimé
    const label = isRelease ? 'du canvas de la sortie' : `du canvas du morceau « ${tracks.find((t) => `canvas_${t.key}` === field)?.title ?? ''} »`;
    if (file.size > CANVAS_MAX_BYTES) {
      throw new HttpError(400, `Le fichier ${label} est trop lourd (${(file.size / 1048576).toFixed(1)} Mo) : ${Math.round(CANVAS_MAX_BYTES / 1048576)} Mo maximum.`);
    }
    const seconds = await readMediaDuration(file.path);
    if (seconds !== null && seconds > CANVAS_MAX_SECONDS) {
      throw new HttpError(400, `La vidéo ${label} dure ${seconds.toFixed(1)} s : 8 secondes maximum.`);
    }
  }
}

/** Supprime du disque les fichiers envoyés mais finalement utilisés nulle part (ex : clé de morceau inconnue). */
function discardUnusedUploads(files) {
  deleteOrphanFiles((files || []).map(uploadedFileUrl));
}

async function computeDurations(tracks, fileMap) {
  const durations = {};
  for (const t of tracks) {
    const file = fileMap[`audio_${t.key}`];
    if (!file) continue;
    const d = await readDuration(file.path);
    if (d < 0) throw new HttpError(400, `Le fichier audio de « ${t.title} » est illisible ou corrompu.`);
    durations[t.key] = d;
  }
  return durations;
}

/**
 * Synchronise les pistes d'une sortie (à appeler DANS une transaction).
 * Retourne la liste des URL de fichiers devenus inutiles.
 */
function saveTracks({ releaseId, primaryArtist, tracks, fileMap, durations }) {
  const obsolete = [];
  const existing = db.prepare('SELECT * FROM tracks WHERE release_id = ?').all(releaseId);
  const existingById = new Map(existing.map((t) => [t.id, t]));

  const keepIds = new Set(tracks.filter((t) => t.id && existingById.has(t.id)).map((t) => t.id));
  for (const old of existing) {
    if (!keepIds.has(old.id)) {
      obsolete.push(old.audio_url, old.canvas_url);
      db.prepare('DELETE FROM tracks WHERE id = ?').run(old.id);
    }
  }

  const insertTrack = db.prepare(
    `INSERT INTO tracks (release_id, track_number, title, audio_url, canvas_url, duration_seconds, isrc, is_explicit, lyrics)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const updateTrack = db.prepare(
    `UPDATE tracks SET track_number = ?, title = ?, audio_url = ?, canvas_url = ?, duration_seconds = ?, isrc = ?, is_explicit = ?, lyrics = ? WHERE id = ?`
  );
  const deleteLinks = db.prepare('DELETE FROM track_artists WHERE track_id = ?');
  const insertLink = db.prepare('INSERT OR IGNORE INTO track_artists (track_id, artist_id, role) VALUES (?, ?, ?)');
  const slugFn = (name) => uniqueArtistSlug(name);

  tracks.forEach((t, index) => {
    const file = fileMap[`audio_${t.key}`];
    const canvasFile = fileMap[`canvas_${t.key}`];
    const old = t.id ? existingById.get(t.id) : null;
    let trackId;

    if (old) {
      let audioUrl = old.audio_url;
      let duration = old.duration_seconds;
      if (file) {
        obsolete.push(old.audio_url);
        audioUrl = fileToUrl('audio', path.basename(file.path));
        duration = durations[t.key] ?? 0;
      }
      let canvasUrl = old.canvas_url;
      if (canvasFile) {
        obsolete.push(old.canvas_url);
        canvasUrl = uploadedFileUrl(canvasFile);
      } else if (t.removeCanvas) {
        obsolete.push(old.canvas_url);
        canvasUrl = null;
      }
      const isrc = t.isrc || old.isrc || generateIsrc();
      updateTrack.run(index + 1, t.title, audioUrl, canvasUrl, duration, isrc, t.is_explicit ? 1 : 0, t.lyrics, old.id);
      trackId = old.id;
    } else {
      if (!file) throw new HttpError(400, `Morceau « ${t.title} » : ajoutez un fichier audio.`);
      const isrc = t.isrc || generateIsrc();
      const info = insertTrack.run(
        releaseId,
        index + 1,
        t.title,
        fileToUrl('audio', path.basename(file.path)),
        canvasFile ? uploadedFileUrl(canvasFile) : null,
        durations[t.key] ?? 0,
        isrc,
        t.is_explicit ? 1 : 0,
        t.lyrics
      );
      trackId = Number(info.lastInsertRowid);
    }

    // Liens artistes : l'artiste de la sortie est toujours "main"
    deleteLinks.run(trackId);
    insertLink.run(trackId, primaryArtist.id, 'main');
    const primaryKey = primaryArtist.name.toLowerCase();
    const mainNames = t.mains.filter((n) => n.toLowerCase() !== primaryKey);
    for (const name of mainNames) insertLink.run(trackId, getOrCreateArtist(name, slugFn), 'main');
    const taken = new Set([primaryKey, ...mainNames.map((n) => n.toLowerCase())]);
    for (const name of t.feats) {
      if (taken.has(name.toLowerCase())) continue;
      insertLink.run(trackId, getOrCreateArtist(name, slugFn), 'feature');
    }
  });

  return obsolete;
}

/* ------------------------------ Création ------------------------------ */

router.post('/distro/releases', requireArtist, handleUpload, async (req, res) => {
  try {
    const artist = db.prepare('SELECT * FROM artists WHERE id = ?').get(req.artistId);
    if (!artist) throw new HttpError(401, 'Artiste introuvable.');

    const payload = parsePayload(req);
    for (const t of payload.tracks) {
      if (!req.fileMap[`audio_${t.key}`]) throw new HttpError(400, `Morceau « ${t.title} » : ajoutez un fichier audio.`);
    }
    await validateCanvasFiles(req.fileMap, payload.tracks);
    const durations = await computeDurations(payload.tracks, req.fileMap);
    const coverUrl = req.fileMap.cover ? fileToUrl('covers', path.basename(req.fileMap.cover.path)) : null;
    const releaseCanvasUrl = req.fileMap.canvas ? uploadedFileUrl(req.fileMap.canvas) : null;

    const releaseId = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO releases (title, type, release_date, label, primary_genre, secondary_genre, cover_url, canvas_url, is_leak, primary_artist_id, visibility, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
        .run(
          payload.title,
          payload.type,
          payload.releaseDate,
          payload.label,
          payload.primaryGenre,
          payload.secondaryGenre,
          coverUrl,
          releaseCanvasUrl,
          payload.isLeak ? 1 : 0,
          artist.id,
          payload.visibility || 'public'
        );
      const id = Number(info.lastInsertRowid);
      saveTracks({ releaseId: id, primaryArtist: artist, tracks: payload.tracks, fileMap: req.fileMap, durations });
      return id;
    })();

    discardUnusedUploads(req.files);
    res.status(201).json({ id: releaseId });
  } catch (err) {
    cleanupUploadedFiles(req.files);
    sendError(res, err);
  }
});

/* ------------------------------ Modification ------------------------------ */

router.put('/distro/releases/:id', requireArtist, handleUpload, async (req, res) => {
  try {
    const artist = db.prepare('SELECT * FROM artists WHERE id = ?').get(req.artistId);
    if (!artist) throw new HttpError(401, 'Artiste introuvable.');
    const id = Number(req.params.id);
    const release = db.prepare('SELECT * FROM releases WHERE id = ? AND primary_artist_id = ?').get(id, artist.id);
    if (!release) throw new HttpError(404, 'Sortie introuvable.');

    const payload = parsePayload(req);
    await validateCanvasFiles(req.fileMap, payload.tracks);
    const durations = await computeDurations(payload.tracks, req.fileMap);

    let coverUrl = release.cover_url;
    const obsolete = [];
    if (req.fileMap.cover) {
      obsolete.push(release.cover_url);
      coverUrl = fileToUrl('covers', path.basename(req.fileMap.cover.path));
    } else if (payload.removeCover) {
      obsolete.push(release.cover_url);
      coverUrl = null;
    }
    let canvasUrl = release.canvas_url;
    if (req.fileMap.canvas) {
      obsolete.push(release.canvas_url);
      canvasUrl = uploadedFileUrl(req.fileMap.canvas);
    } else if (payload.removeCanvas) {
      obsolete.push(release.canvas_url);
      canvasUrl = null;
    }

    const removed = db.transaction(() => {
      db.prepare(
        `UPDATE releases SET title = ?, type = ?, release_date = ?, label = ?, primary_genre = ?, secondary_genre = ?, cover_url = ?, canvas_url = ?, is_leak = ?, visibility = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(
        payload.title,
        payload.type,
        payload.releaseDate,
        payload.label,
        payload.primaryGenre,
        payload.secondaryGenre,
        coverUrl,
        canvasUrl,
        payload.isLeak ? 1 : 0,
        payload.visibility || release.visibility || 'public',
        id
      );
      return saveTracks({ releaseId: id, primaryArtist: artist, tracks: payload.tracks, fileMap: req.fileMap, durations });
    })();

    deleteOrphanFiles([...obsolete, ...removed]);
    discardUnusedUploads(req.files);
    res.json({ id });
  } catch (err) {
    cleanupUploadedFiles(req.files);
    sendError(res, err);
  }
});

/* ------------------------------ Paroles (synchronisées) ------------------------------ */

/**
 * Enregistre les paroles d'un morceau DÉJÀ publié (texte simple ou format LRC synchronisé).
 * La sortie remonte « à la une » comme après toute autre modification.
 */
router.put('/distro/tracks/:id/lyrics', requireArtist, (req, res) => {
  try {
    const id = Number(req.params.id);
    const track = db
      .prepare(
        `SELECT t.id, t.release_id FROM tracks t JOIN releases r ON r.id = t.release_id
         WHERE t.id = ? AND r.primary_artist_id = ?`
      )
      .get(id, req.artistId);
    if (!track) throw new HttpError(404, 'Morceau introuvable.');
    const lyrics = String(req.body?.lyrics ?? '').replace(/\r\n?/g, '\n').slice(0, 30000);
    db.transaction(() => {
      db.prepare('UPDATE tracks SET lyrics = ? WHERE id = ?').run(lyrics, id);
      db.prepare("UPDATE releases SET updated_at = datetime('now') WHERE id = ?").run(track.release_id);
    })();
    res.json({ ok: true, has_lyrics: lyrics.trim() !== '' });
  } catch (err) {
    sendError(res, err);
  }
});

/* ------------------------------ Suppression ------------------------------ */

router.delete('/distro/releases/:id', requireArtist, (req, res) => {
  try {
    const id = Number(req.params.id);
    const release = db.prepare('SELECT * FROM releases WHERE id = ? AND primary_artist_id = ?').get(id, req.artistId);
    if (!release) throw new HttpError(404, 'Sortie introuvable.');

    const urls = [
      release.cover_url,
      release.canvas_url,
      ...db.prepare('SELECT audio_url, canvas_url FROM tracks WHERE release_id = ?').all(id).flatMap((t) => [t.audio_url, t.canvas_url]),
    ];
    db.prepare('DELETE FROM releases WHERE id = ?').run(id);
    deleteOrphanFiles(urls); // supprime les fichiers physiques devenus orphelins
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
});

/* ============================== Sauvegarde / restauration ============================== */

/**
 * Clé administrateur FACULTATIVE (variable d'environnement ADMIN_KEY).
 * - définie : elle est demandée pour télécharger un backup ET pour restaurer
 * - absente : le backup reste ouvert aux artistes connectés ; la restauration est désactivée
 *   en ligne (trop dangereuse sans clé), mais autorisée en local pour les tests.
 */
const restoreAvailable = () => !!ADMIN_KEY || !IS_ONLINE;

router.get('/distro/admin-status', requireArtist, (_req, res) => {
  res.json({ key_required: !!ADMIN_KEY, restore_available: restoreAvailable() });
});

router.post('/distro/backup-link', requireArtist, (req, res) => {
  const gate = checkCode(req, req.body?.admin_key);
  if (!gate.ok) return res.status(gate.status).json({ error: gate.error === 'Code incorrect.' ? 'Clé admin incorrecte.' : gate.error });
  res.json({ url: `/api/distro/backup?t=${encodeURIComponent(signBackupToken(req.artistId))}` });
});

const restoreUploader = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TMP_DIR),
    filename: (_req, _file, cb) => cb(null, `restore-upload-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.zip`),
  }),
  fileFilter(req, file, cb) {
    if (file.fieldname !== 'backup') return cb(new Error('Champ de fichier inattendu.'));
    if (!adminKeyOk(req.body?.admin_key)) return cb(new Error('Clé admin incorrecte.'));
    cb(null, true);
  },
  limits: { fileSize: 8 * 1024 * 1024 * 1024, files: 1 },
}).single('backup');

router.post('/distro/restore', requireArtist, (req, res) => {
  if (!restoreAvailable()) {
    return res.status(403).json({
      error: 'La restauration est désactivée sur ce serveur : ajoutez la variable ADMIN_KEY dans Railway (voir le README), puis réessayez.',
    });
  }
  restoreUploader(req, res, async (err) => {
    const zipPath = req.file?.path;
    if (err) {
      safeUnlink(zipPath);
      return res.status(err.message === 'Clé admin incorrecte.' ? 403 : 400).json({ error: err.message || 'Échec de l\'envoi du fichier.' });
    }
    if (!zipPath) return res.status(400).json({ error: 'Choisissez un fichier de backup (.zip).' });
    if (!adminKeyOk(req.body?.admin_key)) {
      safeUnlink(zipPath);
      return res.status(403).json({ error: 'Clé admin incorrecte.' });
    }
    try {
      const summary = await restoreFromZip(zipPath);
      res.json({ ok: true, summary });
    } catch (e) {
      if (e instanceof RestoreError) return res.status(400).json({ error: e.message });
      console.error('[restore] erreur inattendue :', e);
      res.status(500).json({ error: 'La restauration a échoué de façon inattendue. Vos données actuelles ont été conservées si possible.' });
    }
  });
});

router.get('/distro/backup', async (req, res) => {
  const payload = verifyToken(String(req.query.t || ''), 'backup');
  if (!payload) return res.status(401).type('text/plain').send('Lien de sauvegarde expiré. Relancez le téléchargement depuis le tableau de bord.');

  const tmpDb = path.join(TMP_DIR, `backup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.sqlite`);
  try {
    await db.backup(tmpDb); // copie cohérente de la base, même pendant l'écriture
  } catch (err) {
    console.error('[backup] échec de la copie de la base :', err);
    safeUnlink(tmpDb);
    return res.status(500).type('text/plain').send('Impossible de créer la sauvegarde.');
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="sxtnn-backup-${stamp}.zip"`);
  res.setHeader('Cache-Control', 'no-store');

  const archive = archiver('zip', { zlib: { level: 1 } });
  const cleanup = () => safeUnlink(tmpDb);
  res.on('close', cleanup);
  archive.on('error', (err) => {
    console.error('[backup] erreur archive :', err);
    cleanup();
    res.destroy(err);
  });
  archive.pipe(res);

  archive.file(tmpDb, { name: 'database.sqlite' });
  // Audio et images sont déjà compressés : on les stocke tels quels (beaucoup plus rapide)
  archive.directory(UPLOADS_DIR, 'uploads', (entry) => {
    entry.store = /\.(mp3|ogg|flac|wav|jpg|jpeg|png|webp|gif|avif|mp4|m4v|webm)$/i.test(entry.name);
    return entry;
  });
  archive.finalize();
});

export { GENRES };
export default router;
