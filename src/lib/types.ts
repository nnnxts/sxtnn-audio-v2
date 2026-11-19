export type ReleaseType = 'single' | 'ep' | 'album';
export type ThemeId = 'oled' | 'light' | 'midnight' | 'neon' | 'emerald';
export type Density = 'comfortable' | 'compact';
export type CoverStyle = 'rounded' | 'square';

export interface ArtistRef {
  id: number;
  name: string;
  is_verified: boolean;
  role?: 'main' | 'feature';
}

export interface Artist {
  id: number;
  name: string;
  slug: string;
  bio: string;
  avatar_url: string | null;
  banner_url: string | null;
  is_verified: boolean;
  created_at: string;
  total_plays?: number;
}

export interface Track {
  id: number;
  release_id: number;
  track_number: number;
  title: string;
  audio_url: string;
  /** Canvas du morceau, sinon celui de la sortie (null s'il n'y en a pas) */
  canvas_url: string | null;
  duration_seconds: number;
  isrc: string | null;
  is_explicit: boolean;
  play_count: number;
  has_lyrics: boolean;
  release_title: string;
  cover_url: string | null;
  release_type: ReleaseType;
  is_leak: boolean;
  release_date: string;
  primary_artist_id: number;
  artists: ArtistRef[];
  lyrics?: string;
}

export interface Release {
  id: number;
  title: string;
  type: ReleaseType;
  release_date: string;
  label: string;
  primary_genre: string;
  secondary_genre: string | null;
  cover_url: string | null;
  canvas_url: string | null;
  is_leak: boolean;
  primary_artist_id: number;
  primary_artist_name: string;
  primary_artist_verified: boolean;
  track_count: number;
  total_duration: number;
  play_count: number;
  has_explicit: boolean;
  created_at: string;
  artists: ArtistRef[];
  features: ArtistRef[];
}

export interface User {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  theme_preference: ThemeId;
  density_preference: Density;
  cover_style: CoverStyle;
  created_at: string;
}

export interface PlaylistSummary {
  id: number;
  title: string;
  description: string;
  cover_url: string | null;
  track_count: number;
  total_duration: number;
  updated_at: string;
  mosaic: string[];
}

export interface HomeData {
  featured: Release | null;
  topTracks: Track[];
  artists: Artist[];
  latest: Release[];
}

export interface ArtistPageData {
  artist: Artist;
  total_plays: number;
  followers: number;
  is_following: boolean;
  top_tracks: Track[];
  albums: Release[];
  eps: Release[];
  singles: Release[];
  collabs: Release[];
  leaks: Release[];
}

export interface SearchResults {
  best: { type: 'artist'; item: Artist } | { type: 'track'; item: Track } | { type: 'release'; item: Release } | null;
  tracks: Track[];
  artists: Artist[];
  releases: Release[];
}

/* ---------- Distro ---------- */

export interface DistroTrack {
  id: number;
  track_number: number;
  title: string;
  audio_url: string;
  /** Canvas propre au morceau (sans le repli sur celui de la sortie) */
  canvas_url: string | null;
  duration_seconds: number;
  isrc: string;
  is_explicit: boolean;
  lyrics: string;
  play_count: number;
  mains: string[];
  feats: string[];
}
