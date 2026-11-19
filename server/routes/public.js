import express from 'express';
import db from '../db.js';
import { GENRES } from '../config.js';
import { optionalUser } from '../auth.js';
import {
  TRACK_SELECT,
  RELEASE_SELECT,
  RELEASE_ORDER,
  hydrateTracks,
  hydrateReleases,
  artistDTO,
  artistTotalPlays,
} from '../queries.js';
import { escapeLike } from '../utils.js';

const router = express.Router();

const topTracksSql = (limit) =>
  `${TRACK_SELECT} ORDER BY t.play_count DESC, t.id ASC LIMIT ${Number(limit) || 10}`;

/* ------------------------------ Accueil ------------------------------ */

router.get('/home', (_req, res) => {
  // Sortie à la une : parmi les 8 sorties récentes (hors leaks), celle qui est la plus écoutée
  const candidates = hydrateReleases(
    db
      .prepare(
        `${RELEASE_SELECT} WHERE r.is_leak = 0 AND EXISTS (SELECT 1 FROM tracks t WHERE t.release_id = r.id) ${RELEASE_ORDER} LIMIT 8`
      )
      .all()
  );
  // En cas d'égalité d'écoutes, la plus récente (premier de la liste) l'emporte
  let featured = null;
  for (const c of candidates) {
    if (!featured || c.play_count > featured.play_count) featured = c;
  }

  const topTracks = hydrateTracks(db.prepare(topTracksSql(10)).all());

  const artistRows = db
    .prepare(
      `SELECT a.*,
              (SELECT COALESCE(SUM(t.play_count), 0) FROM tracks t
                 JOIN track_artists ta ON ta.track_id = t.id WHERE ta.artist_id = a.id) AS total_plays
       FROM artists a
       WHERE EXISTS (SELECT 1 FROM track_artists ta WHERE ta.artist_id = a.id)
       ORDER BY total_plays DESC, a.name COLLATE NOCASE ASC`
    )
    .all();
  const artists = artistRows.map((r) => ({ ...artistDTO(r), total_plays: r.total_plays }));

  const latest = hydrateReleases(
    db
      .prepare(
        `${RELEASE_SELECT} WHERE EXISTS (SELECT 1 FROM tracks t WHERE t.release_id = r.id) ${RELEASE_ORDER} LIMIT 32`
      )
      .all()
  );

  res.json({ featured, topTracks, artists, latest });
});

router.get('/top-tracks', (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
  res.json({ tracks: hydrateTracks(db.prepare(topTracksSql(limit)).all()) });
});

router.get('/genres', (_req, res) => {
  res.json({ genres: GENRES });
});

/* ------------------------------ Explorer ------------------------------ */

router.get('/explore', (req, res) => {
  const kind = String(req.query.kind || 'all');
  const genre = String(req.query.genre || '').trim();

  const genres = db
    .prepare(
      `SELECT genre, COUNT(*) AS count FROM (
         SELECT primary_genre AS genre FROM releases
         UNION ALL
         SELECT secondary_genre AS genre FROM releases WHERE secondary_genre IS NOT NULL AND secondary_genre <> ''
       ) WHERE genre IS NOT NULL AND genre <> '' GROUP BY genre ORDER BY count DESC, genre ASC`
    )
    .all();

  const existsTracks = 'EXISTS (SELECT 1 FROM tracks t WHERE t.release_id = r.id)';
  const out = { genres };

  if (kind === 'genre' && genre) {
    out.releases = hydrateReleases(
      db
        .prepare(
          `${RELEASE_SELECT} WHERE (r.primary_genre = ? OR r.secondary_genre = ?) AND ${existsTracks} ${RELEASE_ORDER}`
        )
        .all(genre, genre)
    );
    out.tracks = hydrateTracks(
      db
        .prepare(
          `${TRACK_SELECT} WHERE (r.primary_genre = ? OR r.secondary_genre = ?) ORDER BY t.play_count DESC, t.id ASC LIMIT 20`
        )
        .all(genre, genre)
    );
    return res.json(out);
  }

  if (kind === 'new' || kind === 'all') {
    out.releases = hydrateReleases(
      db
        .prepare(`${RELEASE_SELECT} WHERE r.is_leak = 0 AND ${existsTracks} ${RELEASE_ORDER} LIMIT ${kind === 'new' ? 60 : 16}`)
        .all()
    );
  }

  if (kind === 'gems' || kind === 'all') {
    // Pépites : peu écoutés mais aimés, hors leaks
    out.tracks = hydrateTracks(
      db
        .prepare(
          `${TRACK_SELECT} WHERE r.is_leak = 0 AND t.play_count < 30
           ORDER BY (SELECT COUNT(*) FROM likes l WHERE l.track_id = t.id) DESC, RANDOM()
           LIMIT ${kind === 'gems' ? 40 : 12}`
        )
        .all()
    );
  }

  res.json(out);
});

/* ------------------------------ Artistes ------------------------------ */

router.get('/artist-names', (_req, res) => {
  const rows = db.prepare('SELECT name FROM artists ORDER BY name COLLATE NOCASE').all();
  res.json({ names: rows.map((r) => r.name) });
});

router.get('/artists/:id', optionalUser, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM artists WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Artiste introuvable.' });

  const isMain = `(r.primary_artist_id = @id OR EXISTS (
      SELECT 1 FROM tracks t JOIN track_artists ta ON ta.track_id = t.id
      WHERE t.release_id = r.id AND ta.artist_id = @id AND ta.role = 'main'))`;
  const isFeat = `(NOT ${isMain} AND EXISTS (
      SELECT 1 FROM tracks t JOIN track_artists ta ON ta.track_id = t.id
      WHERE t.release_id = r.id AND ta.artist_id = @id AND ta.role = 'feature'))`;
  const notEmpty = 'EXISTS (SELECT 1 FROM tracks t WHERE t.release_id = r.id)';

  const mainReleases = hydrateReleases(
    db.prepare(`${RELEASE_SELECT} WHERE ${isMain} AND ${notEmpty} ${RELEASE_ORDER}`).all({ id })
  );
  const collabs = hydrateReleases(
    db
      .prepare(`${RELEASE_SELECT} WHERE ${isFeat} AND r.is_leak = 0 AND ${notEmpty} ${RELEASE_ORDER}`)
      .all({ id })
  );

  const albums = mainReleases.filter((r) => !r.is_leak && r.type === 'album');
  const eps = mainReleases.filter((r) => !r.is_leak && r.type === 'ep');
  const singles = mainReleases.filter((r) => !r.is_leak && r.type === 'single');
  const leaks = mainReleases.filter((r) => r.is_leak);

  const topTracks = hydrateTracks(
    db
      .prepare(
        `${TRACK_SELECT} JOIN track_artists ta ON ta.track_id = t.id
         WHERE ta.artist_id = ? ORDER BY t.play_count DESC, t.id ASC LIMIT 5`
      )
      .all(id)
  );

  const followers = db.prepare('SELECT COUNT(*) AS n FROM follows WHERE artist_id = ?').get(id).n;
  const isFollowing = req.userId
    ? !!db.prepare('SELECT 1 FROM follows WHERE user_id = ? AND artist_id = ?').get(req.userId, id)
    : false;

  res.json({
    artist: artistDTO(row),
    total_plays: artistTotalPlays(id),
    followers,
    is_following: isFollowing,
    top_tracks: topTracks,
    albums,
    eps,
    singles,
    collabs,
    leaks,
  });
});

/** Toutes les pistes d'un artiste (pour la "Lecture aléatoire de l'artiste"). */
router.get('/artists/:id/tracks', (req, res) => {
  const id = Number(req.params.id);
  const tracks = hydrateTracks(
    db
      .prepare(
        `${TRACK_SELECT} JOIN track_artists ta ON ta.track_id = t.id
         WHERE ta.artist_id = ? ORDER BY r.release_date DESC, t.track_number ASC`
      )
      .all(id)
  );
  res.json({ tracks });
});

/* ------------------------------ Sorties & pistes ------------------------------ */

router.get('/releases/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`${RELEASE_SELECT} WHERE r.id = ?`).get(id);
  if (!row) return res.status(404).json({ error: 'Sortie introuvable.' });
  const [release] = hydrateReleases([row]);
  const tracks = hydrateTracks(db.prepare(`${TRACK_SELECT} WHERE t.release_id = ? ORDER BY t.track_number ASC, t.id ASC`).all(id));
  res.json({ release, tracks });
});

router.get('/tracks/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`${TRACK_SELECT} WHERE t.id = ?`).get(id);
  if (!row) return res.status(404).json({ error: 'Titre introuvable.' });
  const [track] = hydrateTracks([row]);
  const lyrics = db.prepare('SELECT lyrics FROM tracks WHERE id = ?').get(id)?.lyrics || '';
  res.json({ track: { ...track, lyrics } });
});

/** Appelé par le lecteur après 10 secondes d'écoute effective. */
router.post('/tracks/:id/play', optionalUser, (req, res) => {
  const id = Number(req.params.id);
  const exists = db.prepare('SELECT id FROM tracks WHERE id = ?').get(id);
  if (!exists) return res.status(404).json({ error: 'Titre introuvable.' });
  db.prepare('UPDATE tracks SET play_count = play_count + 1 WHERE id = ?').run(id);
  if (req.userId) db.prepare('INSERT INTO listens (user_id, track_id) VALUES (?, ?)').run(req.userId, id);
  const { play_count } = db.prepare('SELECT play_count FROM tracks WHERE id = ?').get(id);
  res.json({ id, play_count });
});

/* ------------------------------ Recherche ------------------------------ */

router.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (q.length < 1) return res.json({ best: null, tracks: [], artists: [], releases: [] });

  const like = `%${escapeLike(q)}%`;
  const prefix = `${escapeLike(q)}%`;

  const artists = db
    .prepare(
      `SELECT a.*, (SELECT COALESCE(SUM(t.play_count), 0) FROM tracks t
                      JOIN track_artists ta ON ta.track_id = t.id WHERE ta.artist_id = a.id) AS total_plays
       FROM artists a WHERE a.name LIKE ? ESCAPE '\\'
       ORDER BY (a.name LIKE ? ESCAPE '\\') DESC, total_plays DESC LIMIT 6`
    )
    .all(like, prefix)
    .map((r) => ({ ...artistDTO(r), total_plays: r.total_plays }));

  const tracks = hydrateTracks(
    db
      .prepare(
        `${TRACK_SELECT}
         WHERE t.title LIKE @like ESCAPE '\\'
            OR EXISTS (SELECT 1 FROM track_artists ta JOIN artists a ON a.id = ta.artist_id
                       WHERE ta.track_id = t.id AND a.name LIKE @like ESCAPE '\\')
         ORDER BY (t.title LIKE @prefix ESCAPE '\\') DESC, t.play_count DESC LIMIT 8`
      )
      .all({ like, prefix })
  );

  const releases = hydrateReleases(
    db
      .prepare(
        `${RELEASE_SELECT}
         WHERE r.type IN ('album','ep') AND (r.title LIKE @like ESCAPE '\\' OR a.name LIKE @like ESCAPE '\\')
         ORDER BY (r.title LIKE @prefix ESCAPE '\\') DESC, r.release_date DESC LIMIT 6`
      )
      .all({ like, prefix })
  );

  // Meilleur résultat : artiste au nom exact/préfixe, sinon premier titre, sinon artiste, sinon sortie
  const lower = q.toLowerCase();
  let best = null;
  const exactArtist = artists.find((a) => a.name.toLowerCase() === lower) || artists.find((a) => a.name.toLowerCase().startsWith(lower));
  if (exactArtist) best = { type: 'artist', item: exactArtist };
  else if (tracks.length && tracks[0].title.toLowerCase().startsWith(lower)) best = { type: 'track', item: tracks[0] };
  else if (releases.length && releases[0].title.toLowerCase().startsWith(lower)) best = { type: 'release', item: releases[0] };
  else if (tracks.length) best = { type: 'track', item: tracks[0] };
  else if (artists.length) best = { type: 'artist', item: artists[0] };
  else if (releases.length) best = { type: 'release', item: releases[0] };

  res.json({ best, tracks, artists, releases });
});

export default router;
