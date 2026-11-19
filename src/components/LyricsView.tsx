import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import type { Track } from '../lib/types';

/** Charge et affiche les paroles d'un titre (récupérées à la demande pour garder les listes légères). */
export function LyricsView({ trackId, large = false }: { trackId: number; large?: boolean }) {
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setLyrics(null);
    api
      .get<{ track: Track }>(`/tracks/${trackId}`)
      .then((res) => alive && setLyrics((res.track.lyrics || '').trim()))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [trackId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }
  if (error) return <p className="py-10 text-center text-sm text-muted">{error}</p>;
  if (!lyrics) {
    return (
      <div className="py-16 text-center">
        <p className="font-display text-lg font-semibold">Pas de paroles pour ce titre</p>
        <p className="mt-1 text-sm text-muted">L'artiste n'a pas ajouté de paroles.</p>
      </div>
    );
  }
  return (
    <p
      className={`whitespace-pre-wrap font-display font-semibold leading-relaxed tracking-tight ${
        large ? 'text-2xl sm:text-3xl' : 'text-lg'
      }`}
    >
      {lyrics}
    </p>
  );
}
