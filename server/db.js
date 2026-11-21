import Database from 'better-sqlite3';
import { DB_PATH } from './config.js';

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  theme_preference TEXT NOT NULL DEFAULT 'oled',
  density_preference TEXT NOT NULL DEFAULT 'comfortable',
  cover_style TEXT NOT NULL DEFAULT 'rounded',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS artists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  slug TEXT NOT NULL UNIQUE,
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  banner_url TEXT,
  is_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS releases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('single','ep','album')),
  release_date TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Indépendant',
  primary_genre TEXT NOT NULL DEFAULT 'Rap',
  secondary_genre TEXT,
  cover_url TEXT,
  canvas_url TEXT,
  is_leak INTEGER NOT NULL DEFAULT 0,
  primary_artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  release_id INTEGER NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  track_number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  canvas_url TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  isrc TEXT,
  is_explicit INTEGER NOT NULL DEFAULT 0,
  lyrics TEXT NOT NULL DEFAULT '',
  play_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS track_artists (
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('main','feature')),
  PRIMARY KEY (track_id, artist_id)
);

CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS likes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, track_id)
);

CREATE TABLE IF NOT EXISTS follows (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, artist_id)
);

-- Historique d'écoute des comptes connectés (sert aux recommandations)
CREATE TABLE IF NOT EXISTS listens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Amis d'un artiste (liaison anonyme : visible uniquement par l'artiste dans son portail)
CREATE TABLE IF NOT EXISTS friendships (
  artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (artist_id, user_id)
);

-- Liens d'invitation (usage unique, durée limitée)
CREATE TABLE IF NOT EXISTS friend_invites (
  token TEXT PRIMARY KEY,
  artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_releases_artist ON releases(primary_artist_id);
CREATE INDEX IF NOT EXISTS idx_releases_date ON releases(release_date);
CREATE INDEX IF NOT EXISTS idx_tracks_release ON tracks(release_id, track_number);
CREATE INDEX IF NOT EXISTS idx_tracks_plays ON tracks(play_count DESC);
CREATE INDEX IF NOT EXISTS idx_track_artists_artist ON track_artists(artist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_pl ON playlist_tracks(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_user ON follows(user_id);
CREATE INDEX IF NOT EXISTS idx_listens_user ON listens(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_invites_artist ON friend_invites(artist_id);
`);

/* ---------- Mises à jour de schéma pour les bases créées avec une ancienne version ---------- */
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
ensureColumn('releases', 'canvas_url', 'TEXT');
ensureColumn('tracks', 'canvas_url', 'TEXT');
// Nouveautés : dernière modification (sortie à la une) et visibilité ('public' par défaut, ou 'friends')
ensureColumn('releases', 'updated_at', 'TEXT');
ensureColumn('releases', 'visibility', 'TEXT');

// Index qui accélèrent la vérification d'accès aux fichiers (lecture des sorties privées)
db.exec(`
CREATE INDEX IF NOT EXISTS idx_tracks_audio ON tracks(audio_url);
CREATE INDEX IF NOT EXISTS idx_tracks_canvas ON tracks(canvas_url);
CREATE INDEX IF NOT EXISTS idx_releases_canvas ON releases(canvas_url);
CREATE INDEX IF NOT EXISTS idx_releases_updated ON releases(updated_at);
`);

export default db;
