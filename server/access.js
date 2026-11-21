import crypto from 'node:crypto';

/**
 * Code d'accès administrateur (variable d'environnement ADMIN_KEY).
 * Le même code sert à : entrer dans « Accès Artiste », télécharger un backup, restaurer un backup.
 * - défini : il est exigé partout
 * - absent : l'accès artiste reste libre (comme avant) et la restauration est désactivée en ligne
 */
export const ADMIN_KEY = String(process.env.ADMIN_KEY || '').trim();

export const IS_ONLINE =
  process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT || !!process.env.RAILWAY_PROJECT_ID;

export const accessRequired = () => !!ADMIN_KEY;

export function adminKeyOk(provided) {
  if (!ADMIN_KEY) return true;
  const a = crypto.createHash('sha256').update(String(provided || '')).digest();
  const b = crypto.createHash('sha256').update(ADMIN_KEY).digest();
  return crypto.timingSafeEqual(a, b);
}

/* ---------- Anti-devinette : 8 erreurs par 10 minutes et par adresse ---------- */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 8;
const fails = new Map(); // ip -> { count, resetAt }

function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.ip || req.socket?.remoteAddress || 'unknown';
}

export function isLockedOut(req) {
  const entry = fails.get(clientIp(req));
  if (!entry) return false;
  if (entry.resetAt < Date.now()) {
    fails.delete(clientIp(req));
    return false;
  }
  return entry.count >= MAX_FAILS;
}

export function registerFailure(req) {
  const ip = clientIp(req);
  const now = Date.now();
  const entry = fails.get(ip);
  if (!entry || entry.resetAt < now) fails.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count += 1;
}

export function clearFailures(req) {
  fails.delete(clientIp(req));
}

// Nettoyage régulier de la table (évite qu'elle grossisse indéfiniment)
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of fails) if (e.resetAt < now) fails.delete(ip);
}, WINDOW_MS).unref();

/**
 * Vérifie un code en tenant compte de la limite d'essais.
 * Retourne { ok: true } ou { ok: false, status, error }.
 */
export function checkCode(req, provided) {
  if (!ADMIN_KEY) return { ok: true };
  if (isLockedOut(req)) {
    return { ok: false, status: 429, error: 'Trop d\'essais. Réessayez dans quelques minutes.' };
  }
  if (!adminKeyOk(provided)) {
    registerFailure(req);
    return { ok: false, status: 403, error: 'Code incorrect.' };
  }
  clearFailures(req);
  return { ok: true };
}
