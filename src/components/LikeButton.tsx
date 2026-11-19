import { useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { useLibrary } from '../context/LibraryContext';
import type { Track } from '../lib/types';

export function LikeButton({
  track,
  size = 18,
  className = '',
}: {
  track: Pick<Track, 'id' | 'title'>;
  size?: number;
  className?: string;
}) {
  const { isLiked, toggleLike } = useLibrary();
  const liked = isLiked(track.id);
  const [pop, setPop] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (liked) {
      setPop(true);
      const id = window.setTimeout(() => setPop(false), 480);
      return () => window.clearTimeout(id);
    }
  }, [liked]);

  return (
    <button
      type="button"
      aria-label={liked ? 'Retirer des coups de cœur' : 'Ajouter aux coups de cœur'}
      aria-pressed={liked}
      onClick={(e) => {
        e.stopPropagation();
        toggleLike(track);
      }}
      className={`icon-btn h-8 w-8 ${liked ? '!text-accent' : ''} ${className}`}
    >
      <Heart size={size} className={pop ? 'heart-pop' : ''} fill={liked ? 'currentColor' : 'none'} />
    </button>
  );
}
