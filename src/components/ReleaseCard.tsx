import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import type { Release } from '../lib/types';
import { releaseSubtitle, releaseYear, typeLabel } from '../lib/format';
import { usePlayer } from '../context/PlayerContext';
import { usePlayRelease } from '../lib/usePlayRelease';
import { Cover } from './ui/Cover';
import { ExplicitBadge, FriendsBadge, LeakBadge } from './ui/Badges';

export function ReleaseCard({ release, index = 0, className = '' }: { release: Release; index?: number; className?: string }) {
  const { currentTrack, isPlaying, togglePlay } = usePlayer();
  const playRelease = usePlayRelease();
  const isCurrent = currentTrack?.release_id === release.id;
  const playing = isCurrent && isPlaying;

  const onPlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isCurrent) togglePlay();
    else playRelease(release.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.4, delay: Math.min(index, 10) * 0.035, ease: 'easeOut' }}
      className={`group min-w-0 ${className}`}
    >
      <div className="relative">
        <Link to={`/release/${release.id}`} className="block transition-transform duration-300 group-hover:-translate-y-1">
          <Cover src={release.cover_url} alt={release.title} className="w-full" />
          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {release.is_leak && <LeakBadge />}
            {release.visibility === 'friends' && <FriendsBadge />}
            {release.has_explicit && <ExplicitBadge />}
          </div>
        </Link>
        <button
          onClick={onPlay}
          aria-label={playing ? 'Pause' : `Lire ${release.title}`}
          className={`absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-full bg-accent-gradient text-onaccent shadow-glow transition-all duration-300 hover:scale-105 ${
            playing ? 'translate-y-0 opacity-100' : 'touch-visible translate-y-2 opacity-0 group-hover:-translate-y-1 group-hover:opacity-100 focus-visible:opacity-100'
          }`}
        >
          {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
        </button>
      </div>
      <Link to={`/release/${release.id}`} className="mt-3 block">
        <p className="truncate text-sm font-semibold leading-tight hover:underline" title={release.title}>
          {release.title}
        </p>
      </Link>
      <p className="mt-0.5 truncate text-xs text-muted">{releaseSubtitle(release)}</p>
      <p className="mt-0.5 truncate text-[11px] uppercase tracking-wide text-muted/70">
        {typeLabel(release.type)} · {releaseYear(release.release_date)}
      </p>
    </motion.div>
  );
}

/** Grille responsive standard pour des cartes de sorties */
export function ReleaseGrid({ releases, className = '' }: { releases: Release[]; className?: string }) {
  return (
    <div
      className={`grid grid-cols-2 gap-x-[var(--card-gap)] gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 ${className}`}
    >
      {releases.map((r, i) => (
        <ReleaseCard key={r.id} release={r} index={i} />
      ))}
    </div>
  );
}
