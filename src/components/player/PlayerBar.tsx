import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  AlignLeft,
  Film,
  ListMusic,
  ListPlus,
  Loader2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { usePlayer, usePlayerTime } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { formatDuration } from '../../lib/format';
import { useCoverStyle } from '../../lib/palette';
import { useTheme } from '../../context/ThemeContext';
import { Cover } from '../ui/Cover';
import { Equalizer } from '../ui/Misc';
import { tap } from '../../lib/haptics';
import { ExplicitMark } from '../ui/Badges';
import { LikeButton } from '../LikeButton';
import { TrackArtists } from '../TrackRow';
import { trackSubtitle } from '../../lib/format';

function ProgressBar({ variant }: { variant: 'desktop' | 'mobile' }) {
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

  if (variant === 'mobile') {
    return (
      <div className="pointer-events-none absolute inset-x-3 bottom-0 h-[3px] overflow-hidden rounded-full bg-white/15 md:hidden" aria-hidden>
        <div className="h-full rounded-full bg-fg" style={{ width: `${pct}%` }} />
      </div>
    );
  }
  const input = (
    <input
      type="range"
      className="range"
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
      onKeyUp={commit}
      onBlur={commit}
    />
  );
  return (
    <div className="hidden w-full items-center gap-3 md:flex">
      <span className="w-10 text-right text-xs tabular-nums text-muted">{formatDuration(value)}</span>
      <div className="range-wrap flex-1">{input}</div>
      <span className="w-10 text-xs tabular-nums text-muted">{formatDuration(total)}</span>
    </div>
  );
}

function VolumeControl() {
  const { volume, muted, setVolume, toggleMute } = usePlayer();
  const shown = muted ? 0 : volume;
  const Icon = shown === 0 ? VolumeX : shown < 0.5 ? Volume1 : Volume2;
  return (
    <div className="hidden items-center gap-1 md:flex">
      <button className="icon-btn h-9 w-9" onClick={toggleMute} aria-label={muted ? 'Activer le son' : 'Couper le son'} title={muted ? 'Activer le son' : 'Muet'}>
        <Icon size={19} />
      </button>
      <div className="range-wrap w-24">
        <input
          type="range"
          className="range"
          aria-label="Volume"
          min={0}
          max={1}
          step={0.01}
          value={shown}
          style={{ '--p': `${shown * 100}%` } as CSSProperties}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
      </div>
    </div>
  );
}

export function PlayerBar() {
  const { currentTrack, isPlaying, buffering, shuffle, repeat, panel, togglePlay, next, prev, toggleShuffle, cycleRepeat, togglePanel, openFullPlayer } = usePlayer();
  const { openPlaylistPicker } = useLibrary();
  const idle = !currentTrack;
  const { appearance } = useTheme();
  const adapt = useCoverStyle(currentTrack?.cover_url, appearance.adaptPlayer);
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;

  return (
    <div
      className={`glass fixed inset-x-2 z-50 overflow-hidden rounded-2xl border border-line shadow-soft md:inset-x-0 md:overflow-visible md:rounded-none md:border-x-0 md:border-b-0 md:shadow-none ${idle ? 'hidden md:block' : ''}`}
      style={{ bottom: 'calc(var(--mnav-h) + var(--player-gap))', height: 'var(--player-h)', ...adapt }}
    >
      <ProgressBar variant="mobile" />
      <div className="mx-auto grid h-full max-w-[1900px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 pl-2 pr-1 md:gap-3 md:px-5 md:grid-cols-[minmax(0,1fr)_minmax(340px,640px)_minmax(0,1fr)]">
        {/* Gauche : titre en cours */}
        <div className="flex min-w-0 items-center gap-3">
          {currentTrack ? (
            <>
              {/* Mobile : toucher la carte ouvre le lecteur plein écran */}
              <button
                onClick={() => openFullPlayer()}
                className="flex min-w-0 flex-1 items-center gap-3 text-left md:hidden"
                aria-label="Ouvrir le lecteur"
              >
                <Cover src={currentTrack.cover_url} alt={currentTrack.release_title} className="h-12 w-12" flat />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{currentTrack.title}</span>
                    {currentTrack.is_explicit && <ExplicitMark />}
                  </span>
                  <span className="block truncate text-xs text-muted">{trackSubtitle(currentTrack)}</span>
                </span>
              </button>
              <LikeButton track={currentTrack} className="md:hidden" />
              {/* Ordinateur */}
              <div className="hidden min-w-0 items-center gap-3 md:flex">
                <Link to={`/release/${currentTrack.release_id}`} className="group relative shrink-0">
                  <Cover src={currentTrack.cover_url} alt={currentTrack.release_title} className="h-14 w-14" />
                  {isPlaying && (
                    <span className="absolute bottom-1 left-1 hidden rounded bg-black/60 p-1 sm:block">
                      <Equalizer />
                    </span>
                  )}
                </Link>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Link to={`/release/${currentTrack.release_id}`} className="truncate text-sm font-semibold hover:underline">
                      {currentTrack.title}
                    </Link>
                    {currentTrack.is_explicit && <ExplicitMark />}
                  </div>
                  <div className="truncate text-xs text-muted">
                    <TrackArtists track={currentTrack} />
                  </div>
                </div>
                <LikeButton track={currentTrack} />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 text-muted">
              <div className="grid h-12 w-12 place-items-center rounded-cover bg-card sm:h-14 sm:w-14">
                <ListMusic size={22} />
              </div>
              <p className="text-sm">Choisissez un titre pour lancer la lecture</p>
            </div>
          )}
        </div>

        {/* Centre : commandes + progression */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={toggleShuffle}
              aria-label="Lecture aléatoire"
              aria-pressed={shuffle}
              title="Lecture aléatoire"
              className={`icon-btn relative hidden h-9 w-9 md:inline-flex ${shuffle ? '!text-accent' : ''}`}
            >
              <Shuffle size={18} />
              {shuffle && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-accent" />}
            </button>
            <button onClick={prev} disabled={idle} aria-label="Titre précédent" className="icon-btn hidden h-9 w-9 disabled:opacity-40 md:inline-flex">
              <SkipBack size={20} fill="currentColor" />
            </button>
            <button
              onClick={() => {
                tap();
                togglePlay();
              }}
              disabled={idle}
              aria-label={isPlaying ? 'Pause' : 'Lecture'}
              className="grid h-11 w-11 place-items-center rounded-full bg-accent-gradient text-onaccent md:shadow-glow transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:shadow-none"
            >
              {buffering && isPlaying ? (
                <Loader2 size={20} className="animate-spin" />
              ) : isPlaying ? (
                <Pause size={20} fill="currentColor" />
              ) : (
                <Play size={20} fill="currentColor" className="ml-0.5" />
              )}
            </button>
            <button onClick={next} disabled={idle} aria-label="Titre suivant" className="icon-btn h-9 w-9 disabled:opacity-40">
              <SkipForward size={20} fill="currentColor" />
            </button>
            <button
              onClick={cycleRepeat}
              aria-label={repeat === 'off' ? 'Répéter : désactivé' : repeat === 'all' ? 'Répéter tout' : 'Répéter un titre'}
              title={repeat === 'off' ? 'Répéter : désactivé' : repeat === 'all' ? 'Répéter tout' : 'Répéter un titre'}
              className={`icon-btn relative hidden h-9 w-9 md:inline-flex ${repeat !== 'off' ? '!text-accent' : ''}`}
            >
              <RepeatIcon size={18} />
              {repeat !== 'off' && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-accent" />}
            </button>
          </div>
          <ProgressBar variant="desktop" />
        </div>

        {/* Droite : paroles, file d'attente, playlist, volume */}
        <div className="hidden items-center justify-end gap-0.5 md:flex">
          <button
            onClick={() => currentTrack && openPlaylistPicker(currentTrack)}
            disabled={idle}
            aria-label="Ajouter à une playlist"
            title="Ajouter à une playlist"
            className="icon-btn h-9 w-9 disabled:opacity-40"
          >
            <ListPlus size={19} />
          </button>
          <button
            onClick={() => togglePanel('canvas')}
            aria-label="En lecture (canvas)"
            aria-pressed={panel === 'canvas'}
            title="En lecture (canvas)"
            className={`icon-btn relative h-9 w-9 ${panel === 'canvas' ? '!text-accent' : ''}`}
          >
            <Film size={19} />
            {currentTrack?.canvas_url && panel !== 'canvas' && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />}
          </button>
          <button
            onClick={() => togglePanel('lyrics')}
            aria-label="Paroles"
            aria-pressed={panel === 'lyrics'}
            title="Paroles"
            className={`icon-btn h-9 w-9 ${panel === 'lyrics' ? '!text-accent' : ''}`}
          >
            <AlignLeft size={19} />
          </button>
          <button
            onClick={() => togglePanel('queue')}
            aria-label="File d'attente"
            aria-pressed={panel === 'queue'}
            title="File d'attente"
            className={`icon-btn h-9 w-9 ${panel === 'queue' ? '!text-accent' : ''}`}
          >
            <ListMusic size={19} />
          </button>
          <VolumeControl />
        </div>
      </div>
    </div>
  );
}
