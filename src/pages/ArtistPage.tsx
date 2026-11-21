import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Headphones, Loader2, Shuffle, UserCheck, UserPlus, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useApi, useDocumentTitle } from '../lib/hooks';
import type { ArtistPageData, Release, Track } from '../lib/types';
import { formatCount } from '../lib/format';
import { useDominantColor } from '../lib/color';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { useToast } from '../context/ToastContext';
import { Avatar } from '../components/ui/Cover';
import { VerifiedBadge } from '../components/ui/Badges';
import { EmptyState, ErrorState, RowsSkeleton, SectionHeader, Skeleton, CardGridSkeleton } from '../components/ui/Misc';
import { TrackRow } from '../components/TrackRow';
import { ReleaseGrid } from '../components/ReleaseCard';

function ReleaseSection({ title, releases, subtitle }: { title: string; releases: Release[]; subtitle?: string }) {
  if (!releases.length) return null;
  return (
    <section>
      <SectionHeader title={title} subtitle={subtitle} />
      <ReleaseGrid releases={releases} />
    </section>
  );
}

export default function ArtistPage() {
  const { id } = useParams();
  const { data, loading, error, reload, setData } = useApi<ArtistPageData>(`/artists/${id}`, [id]);
  useDocumentTitle(data?.artist.name);
  const { toggleFollow, isFollowing } = useLibrary();
  const { playShuffled } = usePlayer();
  const { error: toastError } = useToast();
  const [busyShuffle, setBusyShuffle] = useState(false);
  const color = useDominantColor(data?.artist.avatar_url);

  // Garde le compteur d'abonnés cohérent avec l'état local
  useEffect(() => {
    if (data) setData((prev) => (prev ? { ...prev, is_following: isFollowing(prev.artist.id) } : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFollowing(Number(id))]);

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
      <div className="space-y-10">
        <Skeleton className="artist-hero-skel -mx-4 h-[340px] !rounded-none sm:-mx-6 md:-mx-[var(--page-pad)] -mt-6" />
        <RowsSkeleton count={5} />
        <CardGridSkeleton count={8} />
      </div>
    );
  }

  const { artist } = data;
  const following = isFollowing(artist.id);
  const hasContent = data.top_tracks.length || data.albums.length || data.eps.length || data.singles.length || data.collabs.length || data.leaks.length;

  const onShuffle = async () => {
    setBusyShuffle(true);
    try {
      const res = await api.get<{ tracks: Track[] }>(`/artists/${artist.id}/tracks`);
      if (res.tracks.length) playShuffled(res.tracks);
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      setBusyShuffle(false);
    }
  };

  const onFollow = async () => {
    const res = await toggleFollow(artist.id);
    if (res) setData((prev) => (prev ? { ...prev, followers: res.followers, is_following: res.following } : prev));
  };

  return (
    <div className="space-y-[var(--section-gap)]">
      {/* Bannière immersive pleine largeur */}
      <section className="artist-hero relative isolate -mx-4 -mt-6 overflow-hidden sm:-mx-6 md:-mx-[var(--page-pad)]">
        {artist.banner_url ? (
          <img src={artist.banner_url} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        ) : (
          <div
            className="absolute inset-0 -z-20"
            style={{ background: `linear-gradient(120deg, rgb(${color ?? 'var(--accent)'}) 0%, rgb(var(--accent2) / 0.6) 100%)` }}
          />
        )}
        <div className="artist-hero-fade absolute inset-0 -z-10 bg-gradient-to-t from-bg via-bg/55 to-black/30" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/45 via-transparent to-transparent" />

        <div className="px-4 pb-8 pt-6 sm:px-6 md:px-[var(--page-pad)]">
          <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur hover:bg-black/55">
            <ArrowLeft size={15} /> Retour à l'accueil
          </Link>

          <div className="mt-14 flex flex-col items-center gap-6 text-center sm:mt-24 sm:flex-row sm:items-end sm:text-left">
            <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 22 }}>
              <Avatar src={artist.avatar_url} name={artist.name} className="h-40 w-40 shadow-[0_24px_50px_-14px_rgba(0,0,0,0.8)] ring-4 ring-white/90 sm:h-48 sm:w-48" />
            </motion.div>
            <div className="min-w-0 flex-1">
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex items-center justify-center gap-1.5 text-sm font-semibold text-white/90 sm:justify-start">
                {artist.is_verified ? (
                  <>
                    <VerifiedBadge size={18} /> Artiste vérifié
                  </>
                ) : (
                  'Artiste'
                )}
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.45 }}
                className="mt-1 break-words font-display text-5xl font-extrabold leading-none tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] sm:text-7xl"
              >
                {artist.name}
              </motion.h1>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm font-medium text-white/85 sm:justify-start">
                <span className="inline-flex items-center gap-1.5">
                  <Headphones size={16} /> {formatCount(data.total_plays)} écoute{data.total_plays > 1 ? 's' : ''} totale{data.total_plays > 1 ? 's' : ''}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users size={16} /> {formatCount(data.followers)} abonné{data.followers > 1 ? 's' : ''}
                </span>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary !px-6 !py-3.5" onClick={onShuffle} disabled={busyShuffle || !hasContent}>
          {busyShuffle ? <Loader2 size={18} className="animate-spin" /> : <Shuffle size={18} />}
          Lecture aléatoire
        </button>
        <button className={`btn !px-6 !py-3.5 ${following ? 'btn-ghost !border-accent !text-accent' : 'btn-ghost'}`} onClick={onFollow}>
          {following ? <UserCheck size={18} /> : <UserPlus size={18} />}
          {following ? 'Abonné' : 'Suivre'}
        </button>
      </div>

      {artist.bio && (
        <section className="max-w-3xl">
          <SectionHeader title="À propos" />
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-fg/85">{artist.bio}</p>
        </section>
      )}

      {!hasContent && (
        <EmptyState title="Aucune sortie pour le moment" text="Cet artiste n'a pas encore publié de musique." />
      )}

      {data.top_tracks.length > 0 && (
        <section>
          <SectionHeader title="Top 5 Titres" subtitle="Les plus écoutés" />
          <div className="max-w-4xl">
            {data.top_tracks.map((t, i) => (
              <TrackRow key={t.id} track={t} tracks={data.top_tracks} index={i} lead="rank" showCover />
            ))}
          </div>
        </section>
      )}

      <ReleaseSection title="Albums" releases={data.albums} />
      <ReleaseSection title="EPs" releases={data.eps} />
      <ReleaseSection title="Singles" releases={data.singles} />
      <ReleaseSection title="Collaborations" subtitle="Featurings sur les sorties d'autres artistes" releases={data.collabs} />
      <ReleaseSection title="Leaks" subtitle="Fuites et versions non officielles" releases={data.leaks} />
    </div>
  );
}
