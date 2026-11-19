import { Heart, Pause, Play, Shuffle } from 'lucide-react';
import { useApi, useDocumentTitle } from '../lib/hooks';
import type { Track } from '../lib/types';
import { formatTotalDuration } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { AuthGate } from '../components/AuthGate';
import { EmptyState, ErrorState, RowsSkeleton } from '../components/ui/Misc';
import { TrackRow } from '../components/TrackRow';
import { Link } from 'react-router-dom';

function LikesContent() {
  const { user } = useAuth();
  const { likedIds } = useLibrary();
  const { data, loading, error, reload } = useApi<{ tracks: Track[] }>('/me/likes', [user?.id]);
  const { currentTrack, isPlaying, playTracks, playShuffled, togglePlay } = usePlayer();

  if (error) return <ErrorState message={error} onRetry={reload} />;

  // Un titre "dé-liké" disparaît immédiatement de la liste
  const tracks = (data?.tracks ?? []).filter((t) => likedIds.has(t.id));
  const total = tracks.reduce((s, t) => s + t.duration_seconds, 0);
  const inList = !!currentTrack && tracks.some((t) => t.id === currentTrack.id);
  const playing = inList && isPlaying;

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-[28px] border border-line/60 p-6 sm:p-10">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-accent/60 via-accent2/30 to-transparent" />
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end">
          <div className="grid h-44 w-44 shrink-0 place-items-center rounded-cover bg-accent-gradient text-onaccent shadow-glow">
            <Heart size={72} fill="currentColor" strokeWidth={1.5} />
          </div>
          <div className="text-center sm:text-left">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-fg/80">Bibliothèque</p>
            <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight sm:text-6xl">Coups de cœur</h1>
            <p className="mt-3 text-sm text-fg/80">
              {user?.username} · {tracks.length} titre{tracks.length > 1 ? 's' : ''}
              {total > 0 && `, ${formatTotalDuration(total)}`}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
              <button className="btn btn-primary !px-6 !py-3.5" disabled={!tracks.length} onClick={() => (inList ? togglePlay() : playTracks(tracks, 0))}>
                {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                {playing ? 'Pause' : 'Lecture'}
              </button>
              <button className="btn btn-ghost !bg-white/10 !py-3.5 backdrop-blur hover:!bg-white/20" disabled={!tracks.length} onClick={() => playShuffled(tracks)}>
                <Shuffle size={17} /> Aléatoire
              </button>
            </div>
          </div>
        </div>
      </header>

      {loading && !data ? (
        <RowsSkeleton count={6} />
      ) : tracks.length === 0 ? (
        <EmptyState
          icon={<Heart size={26} />}
          title="Aucun coup de cœur pour l'instant"
          text="Touchez le cœur à côté d'un titre pour le retrouver ici."
          action={
            <Link to="/explore" className="btn btn-primary">
              Explorer le catalogue
            </Link>
          }
        />
      ) : (
        <div>
          {tracks.map((t, i) => (
            <TrackRow key={t.id} track={t} tracks={tracks} index={i} lead="index" showCover showAlbum />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LikesPage() {
  useDocumentTitle('Coups de cœur');
  return (
    <AuthGate reason="Connectez-vous pour retrouver tous vos coups de cœur.">
      <LikesContent />
    </AuthGate>
  );
}
