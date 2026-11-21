import db from './db.js';
import { signMediaToken } from './auth.js';

/* ============================================================
 * Sorties « amis uniquement »
 * - visibility = 'public' (ou vide)  -> tout le monde
 * - visibility = 'friends'           -> l'artiste propriétaire + ses amis (comptes liés par invitation)
 * ============================================================ */

/** Qui regarde ? (compte auditeur et/ou session artiste) */
export function viewerOf(req) {
  return {
    userId: Number.isInteger(req.userId) ? req.userId : 0,
    artistId: Number.isInteger(req.viewerArtistId) ? req.viewerArtistId : Number.isInteger(req.artistId) ? req.artistId : 0,
  };
}

/**
 * Fragment SQL « cette sortie est visible par ce spectateur ».
 * Les identifiants sont des entiers déjà validés : on les écrit directement dans le SQL.
 */
export function visSql(viewer, alias = 'r') {
  const parts = [`COALESCE(${alias}.visibility, 'public') = 'public'`];
  if (viewer?.artistId) parts.push(`${alias}.primary_artist_id = ${viewer.artistId}`);
  if (viewer?.userId) {
    parts.push(`${alias}.primary_artist_id IN (SELECT artist_id FROM friendships WHERE user_id = ${viewer.userId})`);
  }
  return `(${parts.join(' OR ')})`;
}

/** Vrai si ce spectateur peut voir cette sortie (lecture unitaire). */
export function canSeeRelease(viewer, release) {
  if (!release) return false;
  if ((release.visibility || 'public') === 'public') return true;
  if (viewer?.artistId && viewer.artistId === release.primary_artist_id) return true;
  if (viewer?.userId) {
    return !!db
      .prepare('SELECT 1 FROM friendships WHERE user_id = ? AND artist_id = ?')
      .get(viewer.userId, release.primary_artist_id);
  }
  return false;
}

export function canSeeReleaseId(viewer, releaseId) {
  const row = db.prepare('SELECT id, visibility, primary_artist_id FROM releases WHERE id = ?').get(releaseId);
  return !!row && canSeeRelease(viewer, row);
}

/* ---------- Jetons de lecture pour les fichiers privés ---------- */

export function mediaTokenFor(viewer) {
  if (viewer?.artistId) return signMediaToken('artist', viewer.artistId);
  if (viewer?.userId) return signMediaToken('user', viewer.userId);
  return null;
}

export function withToken(url, token) {
  if (!url || !token || !url.startsWith('/media/')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}t=${encodeURIComponent(token)}`;
}

/**
 * Ajoute le jeton aux URL audio/canvas des sorties privées.
 * À appeler APRÈS le filtrage : on ne fabrique un jeton que pour ce que le spectateur a le droit de voir.
 */
export function tokenizeTracks(tracks, viewer) {
  let token;
  const get = () => (token === undefined ? (token = mediaTokenFor(viewer)) : token);
  return tracks.map((t) => {
    if (t.visibility !== 'friends') return t;
    return { ...t, audio_url: withToken(t.audio_url, get()), canvas_url: withToken(t.canvas_url, get()) };
  });
}

export function tokenizeReleases(releases, viewer) {
  let token;
  const get = () => (token === undefined ? (token = mediaTokenFor(viewer)) : token);
  return releases.map((r) => {
    if (r.visibility !== 'friends' || !r.canvas_url) return r;
    return { ...r, canvas_url: withToken(r.canvas_url, get()) };
  });
}
