import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(__dirname, '..');
export const DIST_DIR = path.join(ROOT_DIR, 'dist');

/**
 * Dossier racine de TOUTES les données modifiables.
 * - variable d'environnement DATA_DIR si définie
 * - sinon /data en production si le Volume Railway est monté
 * - sinon ./data
 */
function resolveDataDir() {
  if (process.env.DATA_DIR && process.env.DATA_DIR.trim()) {
    return path.resolve(process.env.DATA_DIR.trim());
  }
  if (process.env.NODE_ENV === 'production' && fs.existsSync('/data')) {
    return '/data';
  }
  return path.join(ROOT_DIR, 'data');
}

export const DATA_DIR = resolveDataDir();
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const DB_PATH = path.join(DATA_DIR, 'database.sqlite');
export const TMP_DIR = path.join(DATA_DIR, 'tmp');

export const UPLOAD_SUBDIRS = ['audio', 'covers', 'avatars', 'banners', 'canvas'];

/** Limites des canvas (courtes vidéos verticales en boucle) */
export const CANVAS_MAX_SECONDS = 8.5;
export const CANVAS_MAX_BYTES = 15 * 1024 * 1024;

export const PORT = Number(process.env.PORT) || 3000;

export const GENRES = [
  'Rage',
  'Rap',
  'Hip-Hop',
  'Trap',
  'Drill',
  'R&B',
  'Pop',
  'Hyperpop',
  'Électro',
  'House',
  'Techno',
  'Rock',
  'Indie',
  'Jazz',
  'Afrobeats',
  'Reggaeton',
  'Lo-fi',
  'Autre',
];

export const THEMES = ['oled', 'light', 'midnight', 'neon', 'emerald'];
export const DENSITIES = ['comfortable', 'compact'];
export const COVER_STYLES = ['rounded', 'square'];

// Création des dossiers au démarrage
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });
for (const sub of UPLOAD_SUBDIRS) {
  fs.mkdirSync(path.join(UPLOADS_DIR, sub), { recursive: true });
}
