import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion';
import {
  AlignLeft,
  ChevronDown,
  ListMusic,
  ListPlus,
  Loader2,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { usePlayer, usePlayerTime } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { useDominantColor } from '../../lib/color';
import { useMediaQuery } from '../../lib/hooks';
import { formatDuration, trackSubtitle } from '../../lib/format';
import { tap } from '../../lib/haptics';
import { Cover } from '../ui/Cover';
import { ExplicitMark } from '../ui/Badges';
import { LikeButton } from '../LikeButton';
import { TrackMenu } from '../TrackRow';
import { CanvasVideo } from './CanvasVideo';
import { LyricsContent, QueueContent } from './SidePanels';

/** Barre de progression tactile : on la déplace au doigt, la lecture saute au relâchement. */
function SeekBar() {
  const { currentTime, duration } = usePlayerTime();
  const { seek, currentTrack } = usePlayer();
  const [drag, setDrag] = useState<number | null>(null);

  const total = duration || currentTrack?.duration_seconds || 0;
  const value = Math.min(drag ?? currentTime, total || 0);
  const pct = total ? Math.min(100, (value / total) * 100) : 0;

  const commit = () => {
    if (drag !== null) {
      seek(drag);
      setDrag(null);
    }
  };

  return (
    <div>
      <input
        type="range"
        className="range-touch"
        aria-label="Position de lecture"
        min={0}
        max={total || 1}
        step={0.1}
        value={value}
        disabled={!currentTrack}
        style={{ '--p': `${pct}%` } as CSSProperties}
        onChange={(e) => setDrag(Number(e.target.value))}
        onPointerUp={commit}
        onPointerCancel={commit}
        onTouchEnd={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <div className="-mt-1 flex justify-between text-[11px] tabular-nums text-white/60">
        <span>{formatDuration(value)}</span>
        <span>{formatDuration(total)}</span>
      </div>
    </div>
  );
}

const HISTORY_FLAG = 'sxPlayer';

/** Le lecteur plein écran est toujours sombre, quel que soit le thème choisi. */
const PLAYER_VARS = {
  '--fg': '255 255 255',
  '--muted': '176 176 190',
  '--card': '44 44 52',
  '--hover': '62 62 72',
  '--line': '72 72 84',
} as CSSProperties;

export function MobilePlayer() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const {
    currentTrack,
    isPlaying,
    buffering,
    shuffle,
    repeat,
    fullPlayer,
    togglePlay,
    next,
    prev,
    toggleShuffle,
    cycleRepeat,
    openFullPlayer,
    closeFullPlayer,
  } = usePlayer();
  const { openPlaylistPicker } = useLibrary();
  const navigate = useNavigate();
  const controls = useDragControls();
  const color = useDominantColor(currentTrack?.cover_url);

  const open = isMobile && fullPlayer !== null && !!currentTrack;
  const view = fullPlayer ?? 'player';
  const pushed = useRef(false);

  // Tout fermer si on repasse en grand écran ou si la lecture est vidée
  useEffect(() => {
    if (fullPlayer !== null && (!isMobile || !currentTrack)) closeFullPlayer();
  }, [fullPlayer, isMobile, currentTrack, closeFullPlayer]);

  // Le bouton « retour » d'Android ferme le lecteur au lieu de quitter la page
  useEffect(() => {
    if (!open) return;
    if (!pushed.current) {
      try {
        window.history.pushState({ ...(window.history.state ?? {}), [HISTORY_FLAG]: true }, '');
        pushed.current = true;
      } catch {
        /* ignoré */
      }
    }
    const onPop = () => {
      pushed.current = false;
      closeFullPlayer();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [open, closeFullPlayer]);

  // Fermeture par l'interface : on retire l'entrée d'historique ajoutée
  useEffect(() => {
    if (open || !pushed.current) return;
    pushed.current = false;
    if (window.history.state && window.history.state[HISTORY_FLAG]) window.history.back();
  }, [open]);

  // Empêche la page de défiler derrière le lecteur
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 130 || info.velocity.y > 700) closeFullPlayer();
  };

  const goToRelease = () => {
    if (!currentTrack) return;
    const target = `/release/${currentTrack.release_id}`;
    if (pushed.current && window.history.state && window.history.state[HISTORY_FLAG]) {
      // On retire d'abord l'entrée d'historique du lecteur, puis on navigue (évite un retour en arrière parasite)
      pushed.current = false;
      window.addEventListener('popstate', () => window.setTimeout(() => navigate(target), 0), { once: true });
      window.history.back();
      closeFullPlayer();
    } else {
      closeFullPlayer();
      window.setTimeout(() => navigate(target), 60);
    }
  };

  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;
  const track = currentTrack;
  const tint = color ?? 'var(--accent)';

  return (
    <AnimatePresence>
      {open && track && (
        <motion.div
          key="mobile-player"
          className="fixed inset-0 z-[60] overflow-hidden bg-black text-white md:hidden"
          style={PLAYER_VARS}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 340, damping: 38 }}
          drag="y"
          dragControls={controls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          onDragEnd={onDragEnd}
          role="dialog"
          aria-label="Lecteur"
        >
          {/* Fond : canvas flouté ou pochette floutée + teinte de la pochette */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            {track.canvas_url && view === 'player' ? (
              <>
                <CanvasVideo src={track.canvas_url} playing={isPlaying} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/90" />
              </>
            ) : (
              <>
                {track.cover_url && (
                  <img src={track.cover_url} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-3xl" />
                )}
                <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, rgb(${tint} / 0.55), rgb(0 0 0 / 0.88) 70%)` }} />
              </>
            )}
          </div>

          <div className="relative flex h-full flex-col" style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'max(var(--safe-bottom), 12px)' }}>
            {/* En-tête : poignée pour glisser vers le bas */}
            <div className="touch-none px-2 pt-1" onPointerDown={(e) => controls.start(e)}>
              <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-white/30" />
              <div className="flex items-center gap-1">
                <button
                  onClick={closeFullPlayer}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="grid h-11 w-11 place-items-center rounded-full active:bg-white/10"
                  aria-label="Réduire le lecteur"
                >
                  <ChevronDown size={28} />
                </button>
                <button onClick={goToRelease} onPointerDown={(e) => e.stopPropagation()} className="min-w-0 flex-1 px-1 text-center">
                  <span className="block text-[11px] font-semibold uppercase tracking-widest text-white/60">
                    {view === 'queue' ? "File d'attente" : view === 'lyrics' ? 'Paroles' : 'Lecture en cours'}
                  </span>
                  <span className="block truncate text-sm font-bold">{track.release_title}</span>
                </button>
                <div className="grid h-11 w-11 place-items-center" onPointerDown={(e) => e.stopPropagation()}>
                  <TrackMenu track={track} />
                </div>
              </div>
            </div>

            {view === 'player' ? (
              <div className="flex min-h-0 flex-1 flex-col px-6">
                {/* Pochette (le canvas est déjà en fond plein écran) */}
                <div className="flex min-h-0 flex-1 items-center justify-center py-3">
                  {track.canvas_url ? null : (
                    <motion.div
                      key={track.id}
                      initial={{ scale: 0.92, opacity: 0 }}
                      animate={{ scale: isPlaying ? 1 : 0.88, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                      className="aspect-square w-full max-w-[min(100%,46dvh)]"
                    >
                      <Cover src={track.cover_url} alt={track.release_title} className="h-full w-full !shadow-2xl" />
                    </motion.div>
                  )}
                </div>

                {/* Titre + like */}
                <div className="flex items-center gap-3 pb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate font-display text-2xl font-extrabold leading-tight">{track.title}</h2>
                      {track.is_explicit && <ExplicitMark />}
                    </div>
                    <p className="truncate text-base text-white/70">{trackSubtitle(track)}</p>
                  </div>
                  <LikeButton track={track} size={26} className="h-11 w-11 shrink-0" />
                </div>

                <SeekBar />

                {/* Commandes */}
                <div className="flex items-center justify-between py-2">
                  <button
                    onClick={() => {
                      tap();
                      toggleShuffle();
                    }}
                    aria-label="Lecture aléatoire"
                    aria-pressed={shuffle}
                    className={`relative grid h-12 w-12 place-items-center rounded-full active:bg-white/10 ${shuffle ? 'text-accent' : 'text-white/80'}`}
                  >
                    <Shuffle size={22} />
                    {shuffle && <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-accent" />}
                  </button>
                  <button
                    onClick={() => {
                      tap();
                      prev();
                    }}
                    aria-label="Titre précédent"
                    className="grid h-14 w-14 place-items-center rounded-full active:scale-90"
                  >
                    <SkipBack size={32} fill="currentColor" />
                  </button>
                  <button
                    onClick={() => {
                      tap(12);
                      togglePlay();
                    }}
                    aria-label={isPlaying ? 'Pause' : 'Lecture'}
                    className="grid h-[72px] w-[72px] place-items-center rounded-full bg-white text-black shadow-xl transition-transform active:scale-90"
                  >
                    {buffering && isPlaying ? (
                      <Loader2 size={32} className="animate-spin" />
                    ) : isPlaying ? (
                      <Pause size={32} fill="currentColor" />
                    ) : (
                      <Play size={32} fill="currentColor" className="ml-1" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      tap();
                      next();
                    }}
                    aria-label="Titre suivant"
                    className="grid h-14 w-14 place-items-center rounded-full active:scale-90"
                  >
                    <SkipForward size={32} fill="currentColor" />
                  </button>
                  <button
                    onClick={() => {
                      tap();
                      cycleRepeat();
                    }}
                    aria-label={repeat === 'off' ? 'Répéter : désactivé' : repeat === 'all' ? 'Répéter tout' : 'Répéter un titre'}
                    className={`relative grid h-12 w-12 place-items-center rounded-full active:bg-white/10 ${repeat !== 'off' ? 'text-accent' : 'text-white/80'}`}
                  >
                    <RepeatIcon size={22} />
                    {repeat !== 'off' && <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-accent" />}
                  </button>
                </div>

                {/* Rangée du bas */}
                <div className="flex items-center justify-between pb-1 pt-1 text-white/80">
                  <button onClick={() => openPlaylistPicker(track)} aria-label="Ajouter à une playlist" className="grid h-11 w-11 place-items-center rounded-full active:bg-white/10">
                    <ListPlus size={24} />
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openFullPlayer('lyrics')} className="flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold active:bg-white/20">
                      <AlignLeft size={18} /> Paroles
                    </button>
                    <button onClick={() => openFullPlayer('queue')} className="flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold active:bg-white/20">
                      <ListMusic size={18} /> File
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  {view === 'queue' ? <QueueContent /> : <LyricsContent />}
                </div>

                {/* Mini commandes + retour au lecteur */}
                <div className="flex items-center gap-3 border-t border-white/10 bg-black/40 px-4 pt-3 backdrop-blur-xl">
                  <button onClick={() => openFullPlayer('player')} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Retour au lecteur">
                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white/10">
                      {track.cover_url ? <img src={track.cover_url} alt="" className="h-full w-full object-cover" /> : <Music2 className="m-3" size={20} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{track.title}</span>
                      <span className="block truncate text-xs text-white/60">{trackSubtitle(track)}</span>
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      tap();
                      togglePlay();
                    }}
                    aria-label={isPlaying ? 'Pause' : 'Lecture'}
                    className="grid h-12 w-12 place-items-center rounded-full bg-white text-black active:scale-90"
                  >
                    {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-0.5" />}
                  </button>
                  <button onClick={() => { tap(); next(); }} aria-label="Titre suivant" className="grid h-11 w-11 place-items-center rounded-full active:bg-white/10">
                    <SkipForward size={24} fill="currentColor" />
                  </button>
                </div>
                <div className="flex justify-center gap-2 bg-black/40 px-4 pb-1 pt-2 backdrop-blur-xl">
                  <button
                    onClick={() => openFullPlayer('lyrics')}
                    className={`flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold ${view === 'lyrics' ? 'bg-white text-black' : 'bg-white/10'}`}
                  >
                    <AlignLeft size={16} /> Paroles
                  </button>
                  <button
                    onClick={() => openFullPlayer('queue')}
                    className={`flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold ${view === 'queue' ? 'bg-white text-black' : 'bg-white/10'}`}
                  >
                    <ListMusic size={16} /> File
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
