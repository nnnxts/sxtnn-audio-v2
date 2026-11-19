import db from './db.js';

/* ============================================================
 * Requêtes partagées + "hydratation" (ajout des artistes)
 * ============================================================ */

export const TRACK_SELECT = `
  SELECT t.id, t.release_id, t.track_number, t.title, t.audio_url, t.duration_seconds, t.isrc,
         t.is_explicit, t.play_count,
         CASE WHEN t.lyrics IS NOT NULL AND TRIM(t.lyrics) <> '' THEN 1 ELSE 0 END AS has_lyrics,
         COALESCE(t.canvas_url, r.canvas_url) AS canvas_url,
         r.title AS release_title, r.cover_url, r.type AS release_type, r.is_leak, r.release_date,
         r.primary_artist_id
  FROM tracks t
  JOIN releases r ON r.id = t.release_id`;

export const RELEASE_SELECT = `
  SELECT r.id, r.title, r.type, r.release_date, r.label, r.primary_genre, r.secondary_genre,
         r.cover_url, r.canvas_url, r.is_leak, r.primary_artist_id, r.created_at,
         a.name AS primary_artist_name, a.is_verified AS primary_artist_verified,
         (SELECT COUNT(*) FROM tracks t WHERE t.release_id = r.id) AS track_count,
         (SELECT COALESCE(SUM(t.duration_seconds), 0) FROM tracks t WHERE t.release_id = r.id) AS total_duration,
         (SELECT COALESCE(SUM(t.play_count), 0) FROM tracks t WHERE t.release_id = r.id) AS play_count,
         (SELECT COALESCE(MAX(t.is_explicit), 0) FROM tracks t WHERE t.release_id = r.id) AS has_explicit
  FROM releases r
  JOIN artists a ON a.id = r.primary_artist_id`;

export const RELEASE_ORDER = 'ORDER BY r.release_date DESC, r.created_at DESC, r.id DESC';

function placeholders(list) {
  return list.map(() => '?').join(',');
}

/** Ajoute à chaque piste la liste de ses artistes (principaux d'abord, puis feats). */
export function hydrateTracks(rows) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const links = db
    .prepare(
      `SELECT ta.track_id, ta.role, a.id AS artist_id, a.name, a.is_verified
       FROM track_artists ta JOIN artists a ON a.id = ta.artist_id
       WHERE ta.track_id IN (${placeholders(ids)})`
    )
    .all(...ids);

  const byTrack = new Map();
  for (const l of links) {
    if (!byTrack.has(l.track_id)) byTrack.set(l.track_id, []);
    byTrack.get(l.track_id).push({
      id: l.artist_id,
      name: l.name,
      is_verified: !!l.is_verified,
      role: l.role === 'feature' ? 'feature' : 'main',
    });
  }

  return rows.map((r) => {
    const artists = (byTrack.get(r.id) || []).sort((x, y) => {
      if (x.role !== y.role) return x.role === 'main' ? -1 : 1;
      if (x.id === r.primary_artist_id) return -1;
      if (y.id === r.primary_artist_id) return 1;
      return x.name.localeCompare(y.name);
    });
    return {
      ...r,
      is_explicit: !!r.is_explicit,
      is_leak: !!r.is_leak,
      has_lyrics: !!r.has_lyrics,
      artists,
    };
  });
}

/** Ajoute à chaque sortie : artists (principaux) et features. */
export function hydrateReleases(rows) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const links = db
    .prepare(
      `SELECT DISTINCT t.release_id, ta.role, a.id AS artist_id, a.name, a.is_verified
       FROM tracks t
       JOIN track_artists ta ON ta.track_id = t.id
       JOIN artists a ON a.id = ta.artist_id
       WHERE t.release_id IN (${placeholders(ids)})`
    )
    .all(...ids);

  const mains = new Map();
  const feats = new Map();
  for (const l of links) {
    const target = l.role === 'feature' ? feats : mains;
    if (!target.has(l.release_id)) target.set(l.release_id, new Map());
    target.get(l.release_id).set(l.artist_id, { id: l.artist_id, name: l.name, is_verified: !!l.is_verified });
  }

  return rows.map((r) => {
    const mainMap = mains.get(r.id) || new Map();
    if (!mainMap.has(r.primary_artist_id)) {
      mainMap.set(r.primary_artist_id, {
        id: r.primary_artist_id,
        name: r.primary_artist_name,
        is_verified: !!r.primary_artist_verified,
      });
    }
    const artists = [...mainMap.values()].sort((x, y) => {
      if (x.id === r.primary_artist_id) return -1;
      if (y.id === r.primary_artist_id) return 1;
      return x.name.localeCompare(y.name);
    });
    const featMap = feats.get(r.id) || new Map();
    const features = [...featMap.values()].filter((f) => !mainMap.has(f.id));
    return {
      id: r.id,
      title: r.title,
      type: r.type,
      release_date: r.release_date,
      label: r.label,
      primary_genre: r.primary_genre,
      secondary_genre: r.secondary_genre,
      cover_url: r.cover_url,
      canvas_url: r.canvas_url || null,
      is_leak: !!r.is_leak,
      primary_artist_id: r.primary_artist_id,
      primary_artist_name: r.primary_artist_name,
      primary_artist_verified: !!r.primary_artist_verified,
      track_count: r.track_count,
      total_duration: r.total_duration,
      play_count: r.play_count,
      has_explicit: !!r.has_explicit,
      created_at: r.created_at,
      artists,
      features,
    };
  });
}

export function artistDTO(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    bio: row.bio || '',
    avatar_url: row.avatar_url,
    banner_url: row.banner_url,
    is_verified: !!row.is_verified,
    created_at: row.created_at,
  };
}

export function userDTO(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    avatar_url: row.avatar_url,
    theme_preference: row.theme_preference,
    density_preference: row.density_preference,
    cover_style: row.cover_style,
    created_at: row.created_at,
  };
}

export function artistTotalPlays(artistId) {
  return db
    .prepare(
      `SELECT COALESCE(SUM(t.play_count), 0) AS n
       FROM tracks t JOIN track_artists ta ON ta.track_id = t.id
       WHERE ta.artist_id = ?`
    )
    .get(artistId).n;
}

/** Retourne l'id de l'artiste (le crée si besoin). À appeler dans une transaction. */
export function getOrCreateArtist(name, uniqueSlugFn) {
  const found = db.prepare('SELECT id FROM artists WHERE name = ?').get(name);
  if (found) return found.id;
  const info = db
    .prepare('INSERT INTO artists (name, slug) VALUES (?, ?)')
    .run(name, uniqueSlugFn(name));
  return Number(info.lastInsertRowid);
}
