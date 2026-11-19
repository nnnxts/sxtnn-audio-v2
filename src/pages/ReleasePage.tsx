import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Headphones, ListPlus, Pause, Play, Shuffle } from 'lucide-react';
import { useApi, useDocumentTitle } from '../lib/hooks';
import type { Release, Track } from '../lib/types';
import { formatCount, formatReleaseDate, formatTotalDuration, typeLabel } from '../lib/format';
import { useDominantColor } from '../lib/color';
import { usePlayer } from '../context/PlayerContext';
import { useToast } from '../context/ToastContext';
import { Cover } from '../components/ui/Cover';
import { LeakBadge, VerifiedBadge } from '../components/ui/Badges';
import { ErrorState, RowsSkeleton, Skeleton } from '../components/ui/Misc';
import { TrackRow } from '../components/TrackRow';

interface ReleaseData {
  release: Release;
  tracks: Track[];
}

export default function ReleasePage() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi<ReleaseData>(`/releases/${id}`, [id]);
  useDocumentTitle(data?.release.title);
  const { currentTrack, isPlaying, playTracks, playShuffled, togglePlay, addToQueue, playCounts } = usePlayer();
  const { success } = useToast();
  const color = useDominantColor(data?.release.cover_url);

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">
          <ArrowLeft size={16} /> Retour à l'accueil
        </Link>
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-[320px] w-full !rounded-[28px]" />
        <RowsSkeleton count={6} />
      </div>
    );
  }

  const { release, tracks } = data;
  const isCurrent = !!currentTrack && currentTrack.release_id === release.id;
  const playing = isCurrent && isPlaying;
  const totalPlays = tracks.reduce((sum, t) => sum + (playCounts[t.id] ?? t.play_count), 0);
  const genres = [release.primary_genre, release.secondary_genre].filter(Boolean) as string[];

  return (
    <div className="space-y-8">
      <section className="relative isolate overflow-hidden rounded-[28px] border border-line/60 shadow-soft">
        {release.cover_url && (
          <img src={release.cover_url} alt="" aria-hidden className="absolute inset-0 -z-20 h-full w-full scale-150 object-cover opacity-60 blur-[60px] saturate-150" />
        )}
        <div
          className="absolute inset-0 -z-10"
          style={{ background: `linear-gradient(to bottom, rgb(${color ?? 'var(--accent)'} / 0.5), rgb(var(--bg) / 0.88))` }}
        />

        <div className="p-5 sm:p-8">
          <Link to={`/artist/${release.primary_artist_id}`} className="inline-flex items-center gap-2 rounded-full bg-black/30 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur hover:bg-black/50">
            <ArrowLeft size={15} /> {release.primary_artist_name}
          </Link>

          <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:gap-8">
            <motion.div initial={{ opacity: 0, scale: 0.9, rotate: -2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 22 }}>
              <Cover src={release.cover_url} alt={release.title} className="h-56 w-56 sm:h-64 sm:w-64 lg:h-72 lg:w-72 !shadow-[0_30px_70px_-20px_rgba(0,0,0,0.85)]" />
            </motion.div>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-fg/80">{typeLabel(release.type)}</span>
                {release.is_leak && <LeakBadge />}
              </div>
              <h1 className="mt-2 break-words font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">{release.title}</h1>

              <p className="mt-4 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-sm sm:justify-start sm:text-base">
                {release.artists.map((a, i) => (
                  <span key={a.id} className="inline-flex items-center gap-1">
                    {i > 0 && <span className="text-fg/50">,</span>}
                    <Link to={`/artist/${a.id}`} className="inline-flex items-center gap-1 font-bold hover:underline">
                      {a.name}
                      {a.is_verified && <VerifiedBadge size={15} />}
                    </Link>
                  </span>
                ))}
                <span className="text-fg/50">•</span>
                <span className="text-fg/80">{formatReleaseDate(release.release_date)}</span>
                <span className="text-fg/50">•</span>
                <span className="text-fg/80">
                  {release.track_count} titre{release.track_count > 1 ? 's' : ''}, {formatTotalDuration(release.total_duration)}
                </span>
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                <button
                  className="btn btn-primary !px-7 !py-3.5"
                  onClick={() => (isCurrent ? togglePlay() : playTracks(tracks, 0))}
                  disabled={!tracks.length}
                >
                  {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                  {playing ? 'Pause' : 'Lecture'}
                </button>
                <button className="btn btn-ghost !bg-white/10 !py-3.5 backdrop-blur hover:!bg-white/20" onClick={() => playShuffled(tracks)} disabled={!tracks.length}>
                  <Shuffle size={17} /> Aléatoire
                </button>
                <button
                  className="btn btn-ghost !bg-white/10 !py-3.5 backdrop-blur hover:!bg-white/20"
                  onClick={() => {
                    addToQueue(tracks);
                    success('Ajouté à la file d\'attente');
                  }}
                  disabled={!tracks.length}
                >
                  <ListPlus size={17} /> File d'attente
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Liste des pistes */}
      <section>
        <div className="hidden items-center gap-3 border-b border-line px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted sm:flex">
          <span className="w-8 text-center">#</span>
          <span className="flex-1">Titre</span>
          <span className="w-28 text-right">
            <Headphones size={14} className="ml-auto" />
          </span>
          <span className="w-[calc(2rem+0.25rem+2.75rem+2rem)] pr-8 text-right">
            <Clock size={14} className="ml-auto" />
          </span>
        </div>
        <div className="mt-1">
          {tracks.map((t, i) => (
            <TrackRow key={t.id} track={t} tracks={tracks} index={i} lead="number" />
          ))}
        </div>
      </section>

      {/* Informations */}
      <section className="grid gap-x-10 gap-y-3 rounded-3xl border border-line bg-card/50 p-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="label">Date de sortie</p>
          <p className="font-semibold">{formatReleaseDate(release.release_date)}</p>
        </div>
        <div>
          <p className="label">Label</p>
          <p className="font-semibold">{release.label}</p>
        </div>
        <div>
          <p className="label">Genre{genres.length > 1 ? 's' : ''}</p>
          <p className="font-semibold">{genres.join(' · ')}</p>
        </div>
        <div>
          <p className="label">Écoutes cumulées</p>
          <p className="font-semibold tabular-nums">{formatCount(totalPlays)}</p>
        </div>
      </section>
    </div>
  );
}
