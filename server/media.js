import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { UPLOADS_DIR } from './config.js';
import db from './db.js';
import { verifyToken } from './auth.js';
import { canSeeRelease } from './visibility.js';

const router = express.Router();

const AUDIO_TYPES = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
};

const CANVAS_TYPES = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
};

/**
 * Envoi d'un fichier avec HTTP Range (206 Partial Content).
 * - audio : la lecture démarre instantanément, le déplacement dans la barre de temps ne retélécharge rien
 * - canvas : Safari/iOS exige le support de Range pour lire les vidéos
 */
function streamWithRange(subdir, types, notFoundMessage) {
  return (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(UPLOADS_DIR, subdir, filename);
    const contentType = types[path.extname(filename).toLowerCase()] || 'application/octet-stream';

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        return res.status(404).json({ error: notFoundMessage });
      }

      const size = stat.size;
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Cache-Control',
        res.locals.privateMedia ? 'private, max-age=3600' : 'public, max-age=31536000, immutable'
      );
      res.setHeader('Last-Modified', stat.mtime.toUTCString());

      const range = req.headers.range;

      // Pas de Range : on envoie tout le fichier (en flux)
      if (!range) {
        res.status(200);
        res.setHeader('Content-Length', size);
        if (req.method === 'HEAD') return res.end();
        const stream = fs.createReadStream(filePath, { highWaterMark: 256 * 1024 });
        res.on('close', () => stream.destroy());
        stream.on('error', () => res.destroy());
        return stream.pipe(res);
      }

      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (!match || (match[1] === '' && match[2] === '')) {
        res.setHeader('Content-Range', `bytes */${size}`);
        return res.status(416).end();
      }

      let start;
      let end;
      if (match[1] === '') {
        // "bytes=-500" : les 500 derniers octets
        const suffix = Number(match[2]);
        start = Math.max(size - suffix, 0);
        end = size - 1;
      } else {
        start = Number(match[1]);
        end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
      }

      if (Number.isNaN(start) || Number.isNaN(end) || start >= size || start > end) {
        res.setHeader('Content-Range', `bytes */${size}`);
        return res.status(416).end();
      }

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', end - start + 1);
      if (req.method === 'HEAD') return res.end();

      const stream = fs.createReadStream(filePath, { start, end, highWaterMark: 256 * 1024 });
      res.on('close', () => stream.destroy());
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    });
  };
}

/**
 * Protection des sorties « amis uniquement » : un fichier audio/canvas lié à une sortie privée
 * n'est envoyé qu'avec un jeton valide (?t=…) ET si le compte est bien ami de l'artiste (ou l'artiste lui-même).
 * Les fichiers publics ne coûtent qu'une recherche indexée.
 */
const OWNERS_SQL = `
  SELECT COALESCE(r.visibility, 'public') AS visibility, r.primary_artist_id
    FROM tracks t JOIN releases r ON r.id = t.release_id WHERE t.audio_url = @u
  UNION ALL
  SELECT COALESCE(r.visibility, 'public'), r.primary_artist_id
    FROM tracks t JOIN releases r ON r.id = t.release_id WHERE t.canvas_url = @u
  UNION ALL
  SELECT COALESCE(r.visibility, 'public'), r.primary_artist_id FROM releases r WHERE r.canvas_url = @u`;
let ownersStmt;

function guardPrivate(subdir) {
  return (req, res, next) => {
    ownersStmt = ownersStmt || db.prepare(OWNERS_SQL);
    const url = `/media/${subdir}/${path.basename(req.params.filename)}`;
    const owners = ownersStmt.all({ u: url });
    if (!owners.length || owners.some((o) => o.visibility === 'public')) return next();

    const payload = verifyToken(String(req.query.t || ''), 'media');
    const viewer = payload ? (payload.k === 'a' ? { artistId: payload.id } : { userId: payload.id }) : null;
    if (viewer && owners.some((o) => canSeeRelease(viewer, o))) {
      res.locals.privateMedia = true;
      return next();
    }
    res.status(404).json({ error: 'Fichier introuvable.' });
  };
}

router.get('/audio/:filename', guardPrivate('audio'), streamWithRange('audio', AUDIO_TYPES, 'Fichier audio introuvable.'));
router.get('/canvas/:filename', guardPrivate('canvas'), streamWithRange('canvas', CANVAS_TYPES, 'Canvas introuvable.'));

// Images : noms de fichiers aléatoires -> cache agressif sans risque
for (const sub of ['covers', 'avatars', 'banners']) {
  router.use(
    `/${sub}`,
    express.static(path.join(UPLOADS_DIR, sub), {
      maxAge: '365d',
      immutable: true,
      index: false,
      dotfiles: 'deny',
    })
  );
}

export default router;
