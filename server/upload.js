import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseFile } from 'music-metadata';
import { UPLOADS_DIR } from './config.js';
import { cleanupUploadedFiles } from './utils.js';

const AUDIO_EXT = new Set(['.mp3', '.wav', '.flac', '.ogg']);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const VIDEO_EXT = new Set(['.mp4', '.m4v', '.webm']);

/** Détermine le dossier de destination d'après le nom du champ du formulaire. */
function destinationFor(fieldname) {
  if (fieldname.startsWith('audio_')) return 'audio';
  if (fieldname === 'canvas' || fieldname.startsWith('canvas_')) return 'canvas';
  if (fieldname === 'cover') return 'covers';
  if (fieldname === 'avatar') return 'avatars';
  if (fieldname === 'banner') return 'banners';
  return null;
}

const storage = multer.diskStorage({
  destination(_req, file, cb) {
    const sub = destinationFor(file.fieldname);
    if (!sub) return cb(new Error('Champ de fichier inattendu.'));
    cb(null, path.join(UPLOADS_DIR, sub));
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID().replace(/-/g, '')}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const sub = destinationFor(file.fieldname);
  const ext = path.extname(file.originalname).toLowerCase();
  if (sub === 'audio') {
    if (!AUDIO_EXT.has(ext)) return cb(new Error('Format audio non supporté (.mp3, .wav, .flac, .ogg).'));
  } else if (sub === 'canvas') {
    if (!VIDEO_EXT.has(ext)) return cb(new Error('Format vidéo non supporté pour le canvas (.mp4 ou .webm).'));
  } else if (sub) {
    if (!IMAGE_EXT.has(ext)) return cb(new Error('Format d\'image non supporté (.jpg, .png, .webp, .gif).'));
  } else {
    return cb(new Error('Champ de fichier inattendu.'));
  }
  cb(null, true);
}

const uploader = multer({
  storage,
  fileFilter,
  limits: { fileSize: 400 * 1024 * 1024, files: 200 },
}).any();

/**
 * Middleware d'upload. En cas d'erreur, les fichiers déjà écrits sont supprimés.
 * Après passage : req.body (champs texte), req.files (tableau), req.fileMap (par nom de champ).
 */
export function handleUpload(req, res, next) {
  uploader(req, res, (err) => {
    if (err) {
      cleanupUploadedFiles(req.files);
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Fichier trop volumineux (400 Mo maximum).'
          : err.message || 'Échec de l\'envoi des fichiers.';
      return res.status(400).json({ error: message });
    }
    req.files = req.files || [];
    req.fileMap = {};
    for (const f of req.files) req.fileMap[f.fieldname] = f;
    next();
  });
}

/** Durée en secondes d'un fichier audio (calculée avec music-metadata). */
export async function readDuration(filePath) {
  try {
    const meta = await parseFile(filePath, { duration: true });
    const d = meta?.format?.duration;
    if (!d || !Number.isFinite(d)) return 0;
    return Math.round(d);
  } catch {
    return -1; // -1 = fichier illisible
  }
}

/** Durée précise (en secondes) d'un fichier audio ou vidéo, ou null si elle ne peut pas être lue. */
export async function readMediaDuration(filePath) {
  try {
    const meta = await parseFile(filePath, { duration: true });
    const d = meta?.format?.duration;
    return typeof d === 'number' && Number.isFinite(d) && d > 0 ? d : null;
  } catch {
    return null;
  }
}
