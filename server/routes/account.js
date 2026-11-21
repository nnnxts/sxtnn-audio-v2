import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { COVER_STYLES, DENSITIES, THEMES } from '../config.js';
import { requireUser, signUserToken } from '../auth.js';
import { handleUpload } from '../upload.js';
import { RELEASE_SELECT, hydrateReleases, hydrateTracks, TRACK_SELECT, userDTO, artistDTO } from '../queries.js';
import { cleanupUploadedFiles, cleanName, deleteOrphanFiles, fileToUrl } from '../utils.js';
import path from 'node:path';
import { canSeeReleaseId, viewerOf, visSql } from '../visibility.js';

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ============================== Auth ============================== */

router.post('/auth/register', handleUpload, (req, res) => {
  const username = cleanName(req.body.username, 30);
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const avatarFile = req.fileMap.avatar;

  const fail = (status, error) => {
    cleanupUploadedFiles(req.files);
    return res.status(status).json({ error });
  };

  if (username.length < 2) return fail(400, 'Le pseudo doit contenir au moins 2 caractères.');
  if (!EMAIL_RE.test(email)) return fail(400, 'Adresse e-mail invalide.');
  if (password.length < 6) return fail(400, 'Le mot de passe doit contenir au moins 6 caractères.');

  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return fail(409, 'Cette adresse e-mail est déjà utilisée.');
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) return fail(409, 'Ce pseudo est déjà pris.');

  const hash = bcrypt.hashSync(password, 10);
  const avatarUrl = avatarFile ? fileToUrl('avatars', path.basename(avatarFile.path)) : null;
  const info = db
    .prepare('INSERT INTO users (username, email, password_hash, avatar_url) VALUES (?, ?, ?, ?)')
    .run(username, email, hash, avatarUrl);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ token: signUserToken(user.id), user: userDTO(user) });
});

router.post('/auth/login', (req, res) => {
  const identifier = String(req.body?.identifier ?? req.body?.email ?? '').trim();
  const password = String(req.body?.password || '');
  if (!identifier || !password) return res.status(400).json({ error: 'E-mail et mot de passe requis.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(identifier, identifier);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  }
  res.json({ token: signUserToken(user.id), user: userDTO(user) });
});

router.get('/auth/me', requireUser, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(401).json({ error: 'Compte introuvable.' });
  res.json({ user: userDTO(user) });
});

/** Mise à jour du profil + préférences d'apparence (JSON ou multipart avec avatar). */
router.patch('/auth/me', requireUser, handleUpload, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) {
    cleanupUploadedFiles(req.files);
    return res.status(401).json({ error: 'Compte introuvable.' });
  }
  const body = req.body || {};
  const next = { ...user };

  if (body.username !== undefined) {
    const username = cleanName(body.username, 30);
    if (username.length < 2) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({ error: 'Le pseudo doit contenir au moins 2 caractères.' });
    }
    const clash = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (clash && clash.id !== user.id) {
      cleanupUploadedFiles(req.files);
      return res.status(409).json({ error: 'Ce pseudo est déjà pris.' });
    }
    next.username = username;
  }
  if (body.theme_preference !== undefined && THEMES.includes(body.theme_preference)) next.theme_preference = body.theme_preference;
  if (body.density_preference !== undefined && DENSITIES.includes(body.density_preference)) next.density_preference = body.density_preference;
  if (body.cover_style !== undefined && COVER_STYLES.includes(body.cover_style)) next.cover_style = body.cover_style;

  let oldAvatar = null;
  if (req.fileMap.avatar) {
    oldAvatar = user.avatar_url;
    next.avatar_url = fileToUrl('avatars', path.basename(req.fileMap.avatar.path));
  } else if (body.remove_avatar === 'true' || body.remove_avatar === true) {
    oldAvatar = user.avatar_url;
    next.avatar_url = null;
  }

  db.prepare(
    'UPDATE users SET username = ?, avatar_url = ?, theme_preference = ?, density_preference = ?, cover_style = ? WHERE id = ?'
  ).run(next.username, next.avatar_url, next.theme_preference, next.density_preference, next.cover_style, user.id);
  if (oldAvatar) deleteOrphanFiles([oldAvatar]);

  res.json({ user: userDTO(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) });
});

/* ============================== Bibliothèque ============================== */

/** Le titre existe-t-il ET ce spectateur a-t-il le droit de le voir ? */
function visibleTrack(req, trackId) {
  const row = db.prepare('SELECT release_id FROM tracks WHERE id = ?').get(trackId);
  return !!row && canSeeReleaseId(viewerOf(req), row.release_id);
}

function playlistSummaries(userId, onlyId = null, viewer = null) {
  const v = viewer || { userId, artistId: 0 };
  const rows = db
    .prepare(
      `SELECT p.*,
         (SELECT COUNT(*) FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id JOIN releases r ON r.id = t.release_id
            WHERE pt.playlist_id = p.id AND ${visSql(v)}) AS track_count,
         (SELECT COALESCE(SUM(t.duration_seconds), 0) FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id JOIN releases r ON r.id = t.release_id
            WHERE pt.playlist_id = p.id AND ${visSql(v)}) AS total_duration
       FROM playlists p WHERE p.user_id = ? ${onlyId ? 'AND p.id = ?' : ''}
       ORDER BY p.updated_at DESC, p.id DESC`
    )
    .all(...(onlyId ? [userId, onlyId] : [userId]));

  const coversStmt = db.prepare(
    `SELECT DISTINCT r.cover_url FROM playlist_tracks pt
       JOIN tracks t ON t.id = pt.track_id JOIN releases r ON r.id = t.release_id
      WHERE pt.playlist_id = ? AND r.cover_url IS NOT NULL AND ${visSql(v)}
      ORDER BY pt.position ASC LIMIT 4`
  );
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    cover_url: p.cover_url,
    track_count: p.track_count,
    total_duration: p.total_duration,
    updated_at: p.updated_at,
    mosaic: coversStmt.all(p.id).map((c) => c.cover_url),
  }));
}

/** Tout ce qu'il faut pour initialiser l'interface d'un compte connecté. */
router.get('/me/library', requireUser, (req, res) => {
  const likeIds = db.prepare('SELECT track_id FROM likes WHERE user_id = ?').all(req.userId).map((r) => r.track_id);
  const followIds = db.prepare('SELECT artist_id FROM follows WHERE user_id = ?').all(req.userId).map((r) => r.artist_id);
  res.json({ like_ids: likeIds, follow_ids: followIds, playlists: playlistSummaries(req.userId, null, viewerOf(req)) });
});

/* ------------------------------ Coups de cœur ------------------------------ */

router.get('/me/likes', requireUser, (req, res) => {
  const v = viewerOf(req);
  const rows = db
    .prepare(
      `${TRACK_SELECT} JOIN likes l ON l.track_id = t.id WHERE l.user_id = ? AND ${visSql(v)} ORDER BY l.created_at DESC, l.rowid DESC`
    )
    .all(req.userId);
  res.json({ tracks: hydrateTracks(rows, v) });
});

router.post('/tracks/:id/like', requireUser, (req, res) => {
  const trackId = Number(req.params.id);
  if (!visibleTrack(req, trackId)) return res.status(404).json({ error: 'Titre introuvable.' });
  const existing = db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND track_id = ?').get(req.userId, trackId);
  if (existing) {
    db.prepare('DELETE FROM likes WHERE user_id = ? AND track_id = ?').run(req.userId, trackId);
    return res.json({ liked: false });
  }
  db.prepare('INSERT INTO likes (user_id, track_id) VALUES (?, ?)').run(req.userId, trackId);
  res.json({ liked: true });
});

/* ------------------------------ Abonnements ------------------------------ */

router.post('/artists/:id/follow', requireUser, (req, res) => {
  const artistId = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM artists WHERE id = ?').get(artistId)) return res.status(404).json({ error: 'Artiste introuvable.' });
  const existing = db.prepare('SELECT 1 FROM follows WHERE user_id = ? AND artist_id = ?').get(req.userId, artistId);
  if (existing) {
    db.prepare('DELETE FROM follows WHERE user_id = ? AND artist_id = ?').run(req.userId, artistId);
  } else {
    db.prepare('INSERT INTO follows (user_id, artist_id) VALUES (?, ?)').run(req.userId, artistId);
  }
  const followers = db.prepare('SELECT COUNT(*) AS n FROM follows WHERE artist_id = ?').get(artistId).n;
  res.json({ following: !existing, followers });
});

router.get('/me/follows', requireUser, (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.* FROM follows f JOIN artists a ON a.id = f.artist_id WHERE f.user_id = ? ORDER BY f.created_at DESC`
    )
    .all(req.userId);
  res.json({ artists: rows.map(artistDTO) });
});

/* ------------------------------ Recommandations ------------------------------ */

router.get('/me/recommendations', requireUser, (req, res) => {
  const uid = req.userId;
  const v = viewerOf(req);

  // Genres les plus écoutés (écoutes + coups de cœur)
  const genreRows = db
    .prepare(
      `SELECT g, SUM(c) AS score FROM (
         SELECT r.primary_genre AS g, COUNT(*) AS c FROM listens l JOIN tracks t ON t.id = l.track_id JOIN releases r ON r.id = t.release_id WHERE l.user_id = @uid GROUP BY r.primary_genre
         UNION ALL
         SELECT r.secondary_genre AS g, COUNT(*) AS c FROM listens l JOIN tracks t ON t.id = l.track_id JOIN releases r ON r.id = t.release_id WHERE l.user_id = @uid AND r.secondary_genre IS NOT NULL GROUP BY r.secondary_genre
         UNION ALL
         SELECT r.primary_genre AS g, COUNT(*) * 3 AS c FROM likes k JOIN tracks t ON t.id = k.track_id JOIN releases r ON r.id = t.release_id WHERE k.user_id = @uid GROUP BY r.primary_genre
       ) WHERE g IS NOT NULL AND g <> '' GROUP BY g ORDER BY score DESC LIMIT 3`
    )
    .all({ uid });

  // Artistes les plus écoutés / aimés / suivis
  const artistRows = db
    .prepare(
      `SELECT artist_id, SUM(c) AS score FROM (
         SELECT ta.artist_id AS artist_id, COUNT(*) AS c FROM listens l JOIN track_artists ta ON ta.track_id = l.track_id WHERE l.user_id = @uid GROUP BY ta.artist_id
         UNION ALL
         SELECT ta.artist_id, COUNT(*) * 3 FROM likes k JOIN track_artists ta ON ta.track_id = k.track_id WHERE k.user_id = @uid GROUP BY ta.artist_id
         UNION ALL
         SELECT f.artist_id, 10 FROM follows f WHERE f.user_id = @uid
       ) GROUP BY artist_id ORDER BY score DESC LIMIT 6`
    )
    .all({ uid });

  const genres = genreRows.map((g) => g.g);
  const topArtistIds = artistRows.map((a) => a.artist_id);

  if (!genres.length && !topArtistIds.length) {
    return res.json({ ready: false, genres: [], releases: [], artists: [] });
  }

  const conditions = [];
  const params = {};
  genres.forEach((g, i) => {
    params[`g${i}`] = g;
    conditions.push(`r.primary_genre = @g${i} OR r.secondary_genre = @g${i}`);
  });
  topArtistIds.forEach((id, i) => {
    params[`a${i}`] = id;
    conditions.push(`r.primary_artist_id = @a${i}`);
  });

  const releases = hydrateReleases(
    db
      .prepare(
        `${RELEASE_SELECT}
         WHERE r.is_leak = 0 AND ${visSql(v)} AND EXISTS (SELECT 1 FROM tracks t WHERE t.release_id = r.id) AND (${conditions.join(' OR ')})
         ORDER BY ${topArtistIds.length ? `(r.primary_artist_id IN (${topArtistIds.map((_, i) => `@a${i}`).join(',')})) DESC,` : ''} r.release_date DESC, r.id DESC
         LIMIT 12`
      )
      .all(params),
    v
  );

  let artists = [];
  if (genres.length) {
    const gp = {};
    const gc = genres.map((g, i) => {
      gp[`g${i}`] = g;
      return `r.primary_genre = @g${i} OR r.secondary_genre = @g${i}`;
    });
    gp.uid = uid;
    artists = db
      .prepare(
        `SELECT DISTINCT a.* FROM artists a JOIN releases r ON r.primary_artist_id = a.id
         WHERE (${gc.join(' OR ')}) AND ${visSql(v)} AND a.id NOT IN (SELECT artist_id FROM follows WHERE user_id = @uid)
         ORDER BY RANDOM() LIMIT 10`
      )
      .all(gp)
      .map(artistDTO);
  }

  res.json({ ready: true, genres, releases, artists });
});

/* ============================== Playlists ============================== */

function ownedPlaylist(req, res) {
  const id = Number(req.params.id);
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(id, req.userId);
  if (!playlist) {
    res.status(404).json({ error: 'Playlist introuvable.' });
    return null;
  }
  return playlist;
}

function touch(id) {
  db.prepare("UPDATE playlists SET updated_at = datetime('now') WHERE id = ?").run(id);
}

router.get('/playlists', requireUser, (req, res) => {
  res.json({ playlists: playlistSummaries(req.userId, null, viewerOf(req)) });
});

router.post('/playlists', requireUser, (req, res) => {
  const title = cleanName(req.body?.title, 80);
  if (!title) return res.status(400).json({ error: 'Donnez un nom à votre playlist.' });
  const description = String(req.body?.description || '').slice(0, 500);
  const info = db.prepare('INSERT INTO playlists (user_id, title, description) VALUES (?, ?, ?)').run(req.userId, title, description);
  const [summary] = playlistSummaries(req.userId, Number(info.lastInsertRowid), viewerOf(req));
  res.status(201).json({ playlist: summary });
});

router.get('/playlists/:id', requireUser, (req, res) => {
  const playlist = ownedPlaylist(req, res);
  if (!playlist) return;
  const rows = db
    .prepare(`${TRACK_SELECT} JOIN playlist_tracks pt ON pt.track_id = t.id WHERE pt.playlist_id = ? AND ${visSql(viewerOf(req))} ORDER BY pt.position ASC`)
    .all(playlist.id);
  const [summary] = playlistSummaries(req.userId, playlist.id, viewerOf(req));
  res.json({ playlist: summary, tracks: hydrateTracks(rows, viewerOf(req)) });
});

router.patch('/playlists/:id', requireUser, handleUpload, (req, res) => {
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.userId);
  if (!playlist) {
    cleanupUploadedFiles(req.files);
    return res.status(404).json({ error: 'Playlist introuvable.' });
  }
  const body = req.body || {};
  let title = playlist.title;
  if (body.title !== undefined) {
    title = cleanName(body.title, 80);
    if (!title) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({ error: 'Le nom de la playlist ne peut pas être vide.' });
    }
  }
  const description = body.description !== undefined ? String(body.description).slice(0, 500) : playlist.description;

  let coverUrl = playlist.cover_url;
  let oldCover = null;
  if (req.fileMap.cover) {
    oldCover = playlist.cover_url;
    coverUrl = fileToUrl('covers', path.basename(req.fileMap.cover.path));
  } else if (body.remove_cover === 'true') {
    oldCover = playlist.cover_url;
    coverUrl = null;
  }

  db.prepare("UPDATE playlists SET title = ?, description = ?, cover_url = ?, updated_at = datetime('now') WHERE id = ?").run(
    title,
    description,
    coverUrl,
    playlist.id
  );
  if (oldCover) deleteOrphanFiles([oldCover]);
  const [summary] = playlistSummaries(req.userId, playlist.id, viewerOf(req));
  res.json({ playlist: summary });
});

router.delete('/playlists/:id', requireUser, (req, res) => {
  const playlist = ownedPlaylist(req, res);
  if (!playlist) return;
  db.prepare('DELETE FROM playlists WHERE id = ?').run(playlist.id);
  if (playlist.cover_url) deleteOrphanFiles([playlist.cover_url]);
  res.json({ ok: true });
});

router.post('/playlists/:id/tracks', requireUser, (req, res) => {
  const playlist = ownedPlaylist(req, res);
  if (!playlist) return;
  const trackId = Number(req.body?.track_id);
  if (!visibleTrack(req, trackId)) return res.status(404).json({ error: 'Titre introuvable.' });
  const already = db.prepare('SELECT 1 FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?').get(playlist.id, trackId);
  if (already) return res.json({ added: false, already: true });
  const pos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM playlist_tracks WHERE playlist_id = ?').get(playlist.id).p;
  db.prepare('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)').run(playlist.id, trackId, pos);
  touch(playlist.id);
  res.json({ added: true });
});

router.delete('/playlists/:id/tracks/:trackId', requireUser, (req, res) => {
  const playlist = ownedPlaylist(req, res);
  if (!playlist) return;
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?').run(playlist.id, Number(req.params.trackId));
    const rest = db.prepare('SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC').all(playlist.id);
    const upd = db.prepare('UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?');
    rest.forEach((r, i) => upd.run(i, playlist.id, r.track_id));
  });
  tx();
  touch(playlist.id);
  res.json({ ok: true });
});

router.put('/playlists/:id/order', requireUser, (req, res) => {
  const playlist = ownedPlaylist(req, res);
  if (!playlist) return;
  const ids = Array.isArray(req.body?.track_ids) ? req.body.track_ids.map(Number) : [];
  const upd = db.prepare('UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?');
  db.transaction(() => ids.forEach((trackId, i) => upd.run(i, playlist.id, trackId)))();
  touch(playlist.id);
  res.json({ ok: true });
});

export default router;
