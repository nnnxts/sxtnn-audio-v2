import path from 'node:path';
import fs from 'node:fs';
import db from './db.js';
import { UPLOADS_DIR, UPLOAD_SUBDIRS } from './config.js';

/* ------------------------------ Texte ------------------------------ */

export function slugify(text) {
  const s = String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || 'artiste';
}

/** Génère un slug unique pour la table artists (en ignorant l'artiste excludeId). */
export function uniqueArtistSlug(name, excludeId = null) {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  const stmt = db.prepare('SELECT id FROM artists WHERE slug = ?');
  for (;;) {
    const row = stmt.get(slug);
    if (!row || row.id === excludeId) return slug;
    slug = `${base}-${n++}`;
  }
}

export function cleanName(value, max = 60) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** "Drake, Kanye West" ou ["Drake","Kanye West"] -> ["Drake","Kanye West"] (sans doublons, insensible à la casse) */
export function parseTags(value) {
  let list = [];
  if (Array.isArray(value)) list = value;
  else if (typeof value === 'string') list = value.split(',');
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const name = cleanName(raw);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function isValidReleaseDate(value) {
  return /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/.test(String(value || ''));
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function toBool(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'on';
}

export function escapeLike(text) {
  return String(text).replace(/[\\%_]/g, (m) => `\\${m}`);
}

/* ------------------------------ Fichiers ------------------------------ */

/**
 * Convertit une URL relative (/media/audio/xyz.mp3) en chemin disque sécurisé.
 * Retourne null si l'URL est invalide ou sort du dossier uploads.
 */
export function urlToFilePath(url) {
  if (!url || typeof url !== 'string') return null;
  const m = /^\/media\/(audio|covers|avatars|banners|canvas)\/([^/\\]+)$/.exec(url);
  if (!m) return null;
  const [, sub, file] = m;
  if (!UPLOAD_SUBDIRS.includes(sub)) return null;
  const full = path.join(UPLOADS_DIR, sub, path.basename(file));
  return full;
}

export function fileToUrl(sub, filename) {
  return `/media/${sub}/${filename}`;
}

export function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* fichier déjà absent : on ignore */
  }
}

const REFERENCE_QUERIES = [
  'SELECT 1 FROM tracks WHERE audio_url = ? OR canvas_url = ? LIMIT 1',
  'SELECT 1 FROM releases WHERE cover_url = ? OR canvas_url = ? LIMIT 1',
  'SELECT 1 FROM artists WHERE avatar_url = ? OR banner_url = ? LIMIT 1',
  'SELECT 1 FROM users WHERE avatar_url = ? LIMIT 1',
  'SELECT 1 FROM playlists WHERE cover_url = ? LIMIT 1',
];

function isReferenced(url) {
  for (const sql of REFERENCE_QUERIES) {
    const count = (sql.match(/\?/g) || []).length;
    if (db.prepare(sql).get(...Array(count).fill(url))) return true;
  }
  return false;
}

/** Supprime physiquement les fichiers qui ne sont plus référencés nulle part en base. */
export function deleteOrphanFiles(urls) {
  const unique = [...new Set((urls || []).filter(Boolean))];
  for (const url of unique) {
    if (isReferenced(url)) continue;
    safeUnlink(urlToFilePath(url));
  }
}

/** URL relative (/media/...) d'un fichier écrit par multer. */
export function uploadedFileUrl(file) {
  return fileToUrl(path.basename(path.dirname(file.path)), path.basename(file.path));
}

/** Nettoie les fichiers uploadés par multer (en cas d'erreur de validation). */
export function cleanupUploadedFiles(files) {
  if (!Array.isArray(files)) return;
  for (const f of files) safeUnlink(f.path);
}

/* ------------------------------ ISRC ------------------------------ */

export function generateIsrc() {
  const yy = String(new Date().getFullYear()).slice(2);
  const exists = db.prepare('SELECT 1 FROM tracks WHERE isrc = ?');
  for (let i = 0; i < 50; i++) {
    const code = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    const isrc = `FR-SXT-${yy}-${code}`;
    if (!exists.get(isrc)) return isrc;
  }
  return `FR-SXT-${yy}-${Date.now().toString().slice(-5)}`;
}
