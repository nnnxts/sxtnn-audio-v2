import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Artist } from '../lib/types';
import { Avatar } from './ui/Cover';
import { VerifiedBadge } from './ui/Badges';

export function ArtistCard({ artist, index = 0, className = '' }: { artist: Artist; index?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: Math.min(index, 12) * 0.03, ease: 'easeOut' }}
      className={`snap-start ${className}`}
    >
      <Link to={`/artist/${artist.id}`} className="group block w-[132px] text-center sm:w-[150px]">
        <div className="relative mx-auto">
          <Avatar
            src={artist.avatar_url}
            name={artist.name}
            className="h-[132px] w-[132px] shadow-soft ring-2 ring-transparent transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-glow group-hover:ring-accent/60 sm:h-[150px] sm:w-[150px]"
          />
        </div>
        <p className="mt-3 flex items-center justify-center gap-1 text-sm font-semibold">
          <span className="truncate">{artist.name}</span>
          {artist.is_verified && <VerifiedBadge size={15} />}
        </p>
        <p className="text-xs text-muted">Artiste</p>
      </Link>
    </motion.div>
  );
}
