import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { DATA_DIR } from './config.js';

/** Le secret est stocké dans le volume : les connexions survivent aux redémarrages. */
function loadSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) {
    return process.env.JWT_SECRET;
  }
  const file = path.join(DATA_DIR, '.jwt_secret');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch {
    /* pas encore créé */
  }
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

const SECRET = loadSecret();

export function signUserToken(userId) {
  return jwt.sign({ typ: 'user', id: userId }, SECRET, { expiresIn: '60d' });
}

export function signArtistToken(artistId) {
  return jwt.sign({ typ: 'artist', id: artistId }, SECRET, { expiresIn: '60d' });
}

/** Lien de téléchargement à usage unique et très court (backup .zip). */
export function signBackupToken(artistId) {
  return jwt.sign({ typ: 'backup', id: artistId }, SECRET, { expiresIn: '90s' });
}

export function verifyToken(token, expectedType) {
  try {
    const payload = jwt.verify(token, SECRET);
    if (expectedType && payload.typ !== expectedType) return null;
    return payload;
  } catch {
    return null;
  }
}

function bearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

/** Ajoute req.userId si un token auditeur valide est présent (sinon continue sans erreur). */
export function optionalUser(req, _res, next) {
  const token = bearer(req);
  if (token) {
    const payload = verifyToken(token, 'user');
    if (payload) req.userId = payload.id;
  }
  next();
}

export function requireUser(req, res, next) {
  const token = bearer(req);
  const payload = token ? verifyToken(token, 'user') : null;
  if (!payload) return res.status(401).json({ error: 'Connexion requise.' });
  req.userId = payload.id;
  next();
}

export function requireArtist(req, res, next) {
  const token = bearer(req);
  const payload = token ? verifyToken(token, 'artist') : null;
  if (!payload) return res.status(401).json({ error: 'Session artiste expirée. Reconnectez-vous.' });
  req.artistId = payload.id;
  next();
}
