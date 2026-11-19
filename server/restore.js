import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import unzipper from 'unzipper';
import db from './db.js';
import { TMP_DIR, UPLOADS_DIR, UPLOAD_SUBDIRS } from './config.js';

/**
 * Restauration complète à partir d'un backup .zip créé par le bouton de sauvegarde
 * (database.sqlite + dossier uploads/).
 *
 * Étapes :
 *  1. extraction sécurisée du zip dans un dossier temporaire
 *  2. vérification de la base (fichier SQLite valide, tables attendues, fichiers audio présents)
 *  3. remplacement du dossier uploads (l'ancien est mis de côté, puis restauré en cas d'échec)
 *  4. copie du contenu de la base sauvegardée dans la base active, dans une transaction
 *     (les colonnes absentes d'un ancien backup, comme le canvas, restent simplement vides)
 */

export class RestoreError extends Error {}

const LIVE_TABLES = ['users', 'artists', 'releases', 'tracks', 'track_artists', 'playlists', 'playlist_tracks', 'likes', 'follows', 'listens'];
const REQUIRED_TABLES = ['artists', 'releases', 'tracks'];

let restoring = false;

export function isRestoring() {
  return restoring;
}

/** Retourne { kind: 'db' } | { kind: 'upload', sub, file } | null pour une entrée du zip. */
function classifyEntry(entryPath) {
  const parts = String(entryPath).replace(/\\/g, '/').split('/').filter((p) => p && p !== '.');
  if (parts.length === 0 || parts.some((p) => p === '..')) return null;
  const last = parts[parts.length - 1];
  if (last === 'database.sqlite' && parts.length <= 2) return { kind: 'db' };
  const i = parts.indexOf('uploads');
  if (i !== -1 && parts.length === i + 3 && UPLOAD_SUBDIRS.includes(parts[i + 1])) {
    const file = path.basename(parts[i + 2]);
    if (file && !file.startsWith('.')) return { kind: 'upload', sub: parts[i + 1], file };
  }
  return null;
}

function rmQuiet(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch {
    /* on ignore : nettoyage de confort */
  }
}

export async function restoreFromZip(zipPath) {
  if (restoring) throw new RestoreError('Une restauration est déjà en cours.');
  restoring = true;

  const id = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const stage = path.join(TMP_DIR, `restore-${id}`);
  const stageUploads = path.join(stage, 'uploads');
  const stageDb = path.join(stage, 'database.sqlite');
  const oldUploads = path.join(TMP_DIR, `old-uploads-${id}`);
  let filesSwapped = false;
  let attached = false;
  // Suivi des déplacements de fichiers, pour pouvoir tout annuler en cas de problème
  const movedAway = []; // [ancien emplacement (mis de côté), emplacement d'origine]
  const placed = []; // fichiers du backup posés dans uploads/

  /** Annule le remplacement des fichiers : retire ceux du backup, remet les anciens. */
  const rollbackFiles = () => {
    for (const file of placed.reverse()) {
      try {
        fs.unlinkSync(file);
      } catch {
        /* déjà absent */
      }
    }
    for (const [aside, original] of movedAway.reverse()) {
      try {
        fs.renameSync(aside, original);
      } catch (e) {
        console.error('[restore] impossible de remettre', original, e);
      }
    }
    placed.length = 0;
    movedAway.length = 0;
    filesSwapped = false;
  };

  try {
    fs.mkdirSync(stageUploads, { recursive: true });
    for (const sub of UPLOAD_SUBDIRS) fs.mkdirSync(path.join(stageUploads, sub), { recursive: true });

    /* ---------- 1. Extraction ---------- */
    let dbFound = false;
    const counts = { audio: 0, files: 0 };
    try {
      const directory = await unzipper.Open.file(zipPath);
      for (const entry of directory.files) {
        if (entry.type !== 'File') continue;
        const info = classifyEntry(entry.path);
        if (!info) continue;
        if (info.kind === 'db') {
          await pipeline(entry.stream(), fs.createWriteStream(stageDb));
          dbFound = true;
        } else {
          await pipeline(entry.stream(), fs.createWriteStream(path.join(stageUploads, info.sub, info.file)));
          counts.files += 1;
          if (info.sub === 'audio') counts.audio += 1;
        }
      }
    } catch (err) {
      if (err instanceof RestoreError) throw err;
      console.error('[restore] zip illisible :', err);
      throw new RestoreError('Ce fichier n\'est pas un zip valide ou il est corrompu.');
    }
    if (!dbFound) throw new RestoreError('Ce zip ne contient pas de fichier database.sqlite : ce n\'est pas un backup SXTNN.');

    /* ---------- 2. Vérification de la base ---------- */
    let restoreTables;
    let trackCount = 0;
    try {
      db.exec(`ATTACH DATABASE '${stageDb.replace(/'/g, "''")}' AS restore`);
      attached = true;
      const check = db.prepare('PRAGMA restore.quick_check').all();
      if (!check.length || Object.values(check[0])[0] !== 'ok') throw new RestoreError('La base de données du backup est corrompue.');
      restoreTables = new Set(db.prepare("SELECT name FROM restore.sqlite_master WHERE type = 'table'").all().map((r) => r.name));
      for (const t of REQUIRED_TABLES) {
        if (!restoreTables.has(t)) throw new RestoreError('La base du backup n\'a pas la structure attendue (table « ' + t + ' » absente).');
      }
      trackCount = db.prepare('SELECT COUNT(*) AS n FROM restore.tracks').get().n;
    } catch (err) {
      if (err instanceof RestoreError) throw err;
      console.error('[restore] base invalide :', err);
      throw new RestoreError('La base de données du zip est illisible ou invalide.');
    }
    if (trackCount > 0 && counts.audio === 0) {
      throw new RestoreError('Le zip contient la base mais aucun fichier audio (dossier uploads/audio). Utilisez le zip complet du bouton « Backup Complet ».');
    }

    /* ---------- 3. Remplacement des fichiers ---------- */
    // Fichier par fichier (et non en renommant le dossier entier) : Windows refuse de renommer
    // un dossier dont un fichier est ouvert, alors qu'il accepte de déplacer les fichiers un à un.
    try {
      for (const sub of UPLOAD_SUBDIRS) {
        const liveDir = path.join(UPLOADS_DIR, sub);
        const asideDir = path.join(oldUploads, sub);
        fs.mkdirSync(liveDir, { recursive: true });
        fs.mkdirSync(asideDir, { recursive: true });
        for (const name of fs.readdirSync(liveDir)) {
          const aside = path.join(asideDir, name);
          fs.renameSync(path.join(liveDir, name), aside);
          movedAway.push([aside, path.join(liveDir, name)]);
        }
      }
      filesSwapped = true;
      for (const sub of UPLOAD_SUBDIRS) {
        const liveDir = path.join(UPLOADS_DIR, sub);
        const stagedDir = path.join(stageUploads, sub);
        for (const name of fs.readdirSync(stagedDir)) {
          const target = path.join(liveDir, name);
          fs.renameSync(path.join(stagedDir, name), target);
          placed.push(target);
        }
      }
    } catch (err) {
      console.error('[restore] impossible de remplacer les fichiers :', err);
      rollbackFiles();
      const code = err && err.code ? ` (code ${err.code})` : '';
      throw new RestoreError(`Impossible de remplacer les fichiers du site${code}. Vos données actuelles ont été conservées. Fermez les dossiers ou lecteurs qui utilisent le dossier data, puis réessayez.`);
    }

    /* ---------- 4. Remplacement du contenu de la base ---------- */
    try {
      db.pragma('foreign_keys = OFF');
      db.transaction(() => {
        for (const t of [...LIVE_TABLES].reverse()) db.exec(`DELETE FROM main.${t}`);
        for (const t of LIVE_TABLES) {
          if (!restoreTables.has(t)) continue;
          const liveCols = db.prepare(`PRAGMA main.table_info(${t})`).all().map((c) => c.name);
          const savedCols = new Set(db.prepare(`PRAGMA restore.table_info(${t})`).all().map((c) => c.name));
          const cols = liveCols.filter((c) => savedCols.has(c));
          if (!cols.length) continue;
          const list = cols.map((c) => `"${c}"`).join(', ');
          db.exec(`INSERT INTO main.${t} (${list}) SELECT ${list} FROM restore.${t}`);
        }
      })();
    } catch (err) {
      console.error('[restore] échec de la copie de la base, retour en arrière :', err);
      // On remet les anciens fichiers en place (la base, elle, a été annulée par la transaction)
      rollbackFiles();
      throw new RestoreError('La restauration a échoué pendant la copie de la base. Vos données actuelles ont été conservées.');
    } finally {
      db.pragma('foreign_keys = ON');
    }

    const summary = {
      artists: db.prepare('SELECT COUNT(*) AS n FROM artists').get().n,
      releases: db.prepare('SELECT COUNT(*) AS n FROM releases').get().n,
      tracks: db.prepare('SELECT COUNT(*) AS n FROM tracks').get().n,
      files: counts.files,
    };
    if (filesSwapped) fs.promises.rm(oldUploads, { recursive: true, force: true }).catch(() => {});
    return summary;
  } finally {
    if (attached) {
      try {
        db.exec('DETACH DATABASE restore');
      } catch {
        /* déjà détachée */
      }
    }
    rmQuiet(stage);
    rmQuiet(zipPath);
    restoring = false;
  }
}
