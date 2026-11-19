import type { ArtistRef, Release, ReleaseType, Track } from './types';

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** 4520 -> "1 h 15 min" ; 750 -> "12 min 30 s" */
export function formatTotalDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m > 0) return sec > 0 ? `${m} min ${String(sec).padStart(2, '0')} s` : `${m} min`;
  return `${sec} s`;
}

export function formatCount(n: number): string {
  return Math.round(n || 0).toLocaleString('fr-FR');
}

export function formatPlays(n: number): string {
  const v = Math.round(n || 0);
  return `${formatCount(v)} écoute${v > 1 ? 's' : ''}`;
}

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** "2026" | "2026-10" | "2026-10-05" -> "2026" | "octobre 2026" | "5 octobre 2026" */
export function formatReleaseDate(value: string): string {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value || '');
  if (!m) return value || '';
  const [, y, mo, d] = m;
  if (!mo) return y;
  const month = MONTHS[Number(mo) - 1] ?? mo;
  if (!d) return `${month} ${y}`;
  return `${Number(d) === 1 ? '1er' : Number(d)} ${month} ${y}`;
}

export function releaseYear(value: string): string {
  return (value || '').slice(0, 4);
}

export function typeLabel(type: ReleaseType): string {
  return type === 'album' ? 'Album' : type === 'ep' ? 'EP' : 'Single';
}

export function typeLabelPlural(type: ReleaseType): string {
  return type === 'album' ? 'Albums' : type === 'ep' ? 'EPs' : 'Singles';
}

export function artistNames(artists: ArtistRef[]): string {
  return artists.map((a) => a.name).join(', ');
}

/** "sxtnn, Drake" pour les artistes principaux d'une piste, "feat. X" pour les invités. */
export function trackMainNames(track: Track): string {
  const mains = track.artists.filter((a) => a.role !== 'feature');
  return mains.map((a) => a.name).join(', ');
}

export function trackFeatNames(track: Track): string {
  const feats = track.artists.filter((a) => a.role === 'feature');
  return feats.map((a) => a.name).join(', ');
}

export function trackSubtitle(track: Track): string {
  const mains = trackMainNames(track);
  const feats = trackFeatNames(track);
  return feats ? `${mains} · feat. ${feats}` : mains;
}

export function releaseSubtitle(release: Release): string {
  return release.artists.map((a) => a.name).join(', ');
}

/** Teinte stable (0-359) pour un texte : pastilles de genre, avatars sans image. */
export function hueFromText(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function plural(n: number, one: string, many: string): string {
  return `${formatCount(n)} ${n > 1 ? many : one}`;
}
