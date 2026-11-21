import { memo, useEffect, useRef, useState } from 'react';
import { Loader2, Mic2 } from 'lucide-react';
import { api } from '../lib/api';
import { activeLineIndex, parseLyrics, type LrcLine } from '../lib/lrc';
import { usePlayer, usePlayerTime } from '../context/PlayerContext';
import type { Track } from '../lib/types';

const SyncedLine = memo(function SyncedLine({
  line,
  state,
  large,
  onClick,
  index,
}: {
  line: LrcLine;
  state: 'past' | 'active' | 'next';
  large: boolean;
  onClick: (index: number) => void;
  index: number;
}) {
  const size = large ? 'text-2xl sm:text-3xl' : 'text-lg';
  const tone = state === 'active' ? 'scale-100 text-fg opacity-100' : state === 'past' ? 'text-muted opacity-60' : 'text-muted opacity-45';
  return (
    <button
      type="button"
      data-active={state === 'active' ? '1' : undefined}
      onClick={() => onClick(index)}
      className={`block w-full origin-left text-left font-display font-bold leading-snug tracking-tight transition-all duration-300 hover:opacity-100 ${size} ${tone} ${
        state === 'active' ? '' : 'scale-[0.96]'
      }`}
    >
      {line.text || '♪'}
    </button>
  );
});

/** Paroles défilantes (style Musixmatch) : la ligne en cours est mise en avant et suit la lecture. */
function SyncedLyrics({ lines, follow, large }: { lines: LrcLine[]; follow: boolean; large: boolean }) {
  const { currentTime } = usePlayerTime();
  const { seek } = usePlayer();
  const boxRef = useRef<HTMLDivElement>(null);
  const pausedUntil = useRef(0);

  // +0.15 s : compense le rythme de mise à jour du lecteur pour que la ligne s'allume pile à l'heure
  const active = follow ? activeLineIndex(lines, currentTime + 0.15) : -1;

  // Si la personne fait défiler elle-même, on arrête de forcer le défilement quelques secondes
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const pause = () => {
      pausedUntil.current = Date.now() + 4000;
    };
    el.addEventListener('wheel', pause, { passive: true });
    el.addEventListener('touchmove', pause, { passive: true });
    return () => {
      el.removeEventListener('wheel', pause);
      el.removeEventListener('touchmove', pause);
    };
  }, []);

  useEffect(() => {
    if (!follow || active < 0 || Date.now() < pausedUntil.current) return;
    const target = boxRef.current?.querySelector<HTMLElement>('[data-active="1"]');
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [active, follow]);

  return (
    <div ref={boxRef} className="space-y-4 py-[18vh]">
      {lines.map((line, i) => (
        <SyncedLine
          key={i}
          index={i}
          line={line}
          large={large}
          state={!follow ? 'next' : i === active ? 'active' : i < active ? 'past' : 'next'}
          onClick={(idx) => follow && seek(lines[idx].t)}
        />
      ))}
    </div>
  );
}

/** Charge et affiche les paroles d'un titre (récupérées à la demande pour garder les listes légères). */
export function LyricsView({ trackId, large = false }: { trackId: number; large?: boolean }) {
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentTrack } = usePlayer();

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

  const parsed = parseLyrics(lyrics);
  if (parsed.synced) {
    const follow = currentTrack?.id === trackId;
    return (
      <div>
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
          <Mic2 size={13} /> Paroles synchronisées{follow ? '' : ' · lancez le titre pour les voir défiler'}
        </p>
        <SyncedLyrics lines={parsed.lines} follow={follow} large={large} />
      </div>
    );
  }
  return (
    <p
      className={`whitespace-pre-wrap font-display font-semibold leading-relaxed tracking-tight ${
        large ? 'text-2xl sm:text-3xl' : 'text-lg'
      }`}
    >
      {parsed.plain}
    </p>
  );
}
