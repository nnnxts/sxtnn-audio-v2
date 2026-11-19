import { Reorder, useDragControls, AnimatePresence, motion } from 'framer-motion';
import { AlignLeft, Film, GripVertical, ListMusic, Pause, Play, Trash2, X } from 'lucide-react';
import { usePlayer, type QueueItem } from '../../context/PlayerContext';
import { useDominantColor } from '../../lib/color';
import { formatDuration, trackSubtitle } from '../../lib/format';
import { Cover } from '../ui/Cover';
import { Equalizer } from '../ui/Misc';
import { ExplicitMark } from '../ui/Badges';
import { LyricsView } from '../LyricsView';
import { CanvasVideo } from './CanvasVideo';

function QueueRow({ item, onPlay, onRemove }: { item: QueueItem; onPlay: () => void; onRemove: () => void }) {
  const controls = useDragControls();
  const { track } = item;
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="group relative flex items-center gap-2 rounded-2xl px-2 py-1.5 transition-colors hover:bg-card"
      whileDrag={{ scale: 1.02, backgroundColor: 'rgb(var(--hover))', boxShadow: '0 12px 30px -10px rgba(0,0,0,.6)', zIndex: 5 }}
    >
      <button
        className="icon-btn h-8 w-6 shrink-0 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(e) => controls.start(e)}
        aria-label="Déplacer"
      >
        <GripVertical size={16} />
      </button>
      <button onClick={onPlay} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Cover src={track.cover_url} alt={track.release_title} className="h-10 w-10" flat />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{track.title}</span>
            {track.is_explicit && <ExplicitMark />}
          </span>
          <span className="block truncate text-xs text-muted">{trackSubtitle(track)}</span>
        </span>
      </button>
      <span className="text-xs tabular-nums text-muted">{formatDuration(track.duration_seconds)}</span>
      <button className="icon-btn h-8 w-8 shrink-0 opacity-60 hover:!opacity-100" onClick={onRemove} aria-label="Retirer de la file d'attente">
        <X size={16} />
      </button>
    </Reorder.Item>
  );
}

export function QueueContent() {
  const { queue, current, isPlaying, shuffle, reorderQueue, removeFromQueue, clearQueue, playQueueItem, togglePlay } = usePlayer();
  const idx = current ? queue.findIndex((q) => q.uid === current.uid) : -1;
  const upcoming = queue.slice(idx + 1);
  const head = queue.slice(0, idx + 1);

  if (!queue.length) {
    return (
      <div className="grid h-full place-items-center px-8 text-center">
        <div>
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-card text-accent">
            <ListMusic size={26} />
          </div>
          <p className="font-display text-lg font-bold">La file d'attente est vide</p>
          <p className="mt-1 text-sm text-muted">Lancez un titre ou ajoutez-en depuis le menu « … ».</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 pb-6">
      {current && (
        <>
          <p className="px-2 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-muted">En cours de lecture</p>
          <div className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2.5">
            <div className="relative">
              <Cover src={current.track.cover_url} alt={current.track.release_title} className="h-12 w-12" flat />
              <button
                onClick={togglePlay}
                className="absolute inset-0 grid place-items-center rounded-cover bg-black/50 text-white"
                aria-label={isPlaying ? 'Pause' : 'Lecture'}
              >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-accent">{current.track.title}</p>
              <p className="truncate text-xs text-muted">{trackSubtitle(current.track)}</p>
            </div>
            {isPlaying && <Equalizer />}
          </div>
        </>
      )}

      <div className="flex items-center justify-between px-2 pb-2 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">À suivre · {upcoming.length}</p>
        {upcoming.length > 0 && (
          <button className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-fg" onClick={clearQueue}>
            <Trash2 size={13} /> Vider
          </button>
        )}
      </div>
      {shuffle && upcoming.length > 0 && (
        <p className="mb-2 rounded-xl bg-card px-3 py-2 text-xs text-muted">
          Mode aléatoire activé : l'ordre de lecture réel varie. Désactivez-le pour suivre cette liste dans l'ordre.
        </p>
      )}
      {upcoming.length === 0 ? (
        <p className="px-2 text-sm text-muted">Plus rien après ce titre.</p>
      ) : (
        <Reorder.Group axis="y" values={upcoming} onReorder={(items) => reorderQueue([...head, ...items])} className="space-y-0.5">
          {upcoming.map((item) => (
            <QueueRow key={item.uid} item={item} onPlay={() => playQueueItem(item.uid)} onRemove={() => removeFromQueue(item.uid)} />
          ))}
        </Reorder.Group>
      )}
    </div>
  );
}

export function LyricsContent() {
  const { currentTrack } = usePlayer();
  const color = useDominantColor(currentTrack?.cover_url);

  if (!currentTrack) {
    return (
      <div className="grid h-full place-items-center px-8 text-center">
        <div>
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-card text-accent">
            <AlignLeft size={26} />
          </div>
          <p className="font-display text-lg font-bold">Aucun titre en cours</p>
          <p className="mt-1 text-sm text-muted">Les paroles s'affichent ici pendant la lecture.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{ background: `linear-gradient(to bottom, rgb(${color ?? 'var(--accent)'} / 0.45), transparent)` }}
      />
      <div className="relative px-6 pb-10 pt-6">
        <div className="mb-6 flex items-center gap-3">
          <Cover src={currentTrack.cover_url} alt={currentTrack.release_title} className="h-14 w-14" />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold">{currentTrack.title}</p>
            <p className="truncate text-sm text-muted">{trackSubtitle(currentTrack)}</p>
          </div>
        </div>
        <LyricsView trackId={currentTrack.id} large />
      </div>
    </div>
  );
}

function NowPlayingContent() {
  const { currentTrack, isPlaying } = usePlayer();
  const color = useDominantColor(currentTrack?.cover_url);

  if (!currentTrack) {
    return (
      <div className="grid h-full place-items-center px-8 text-center">
        <div>
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-card text-accent">
            <Film size={26} />
          </div>
          <p className="font-display text-lg font-bold">Aucun titre en cours</p>
          <p className="mt-1 text-sm text-muted">Le canvas du morceau s'affiche ici pendant la lecture.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80"
        style={{ background: `linear-gradient(to bottom, rgb(${color ?? 'var(--accent)'} / 0.45), transparent)` }}
      />
      <div className="relative px-6 pb-8 pt-6">
        {currentTrack.canvas_url ? (
          <div className="mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-3xl bg-card shadow-soft ring-1 ring-line">
            <CanvasVideo src={currentTrack.canvas_url} playing={isPlaying} />
          </div>
        ) : (
          <Cover src={currentTrack.cover_url} alt={currentTrack.release_title} className="mx-auto w-full max-w-[300px]" />
        )}
        <div className="mt-6 min-w-0 text-center">
          <p className="truncate font-display text-xl font-extrabold">{currentTrack.title}</p>
          <p className="truncate text-sm text-muted">{trackSubtitle(currentTrack)}</p>
          {!currentTrack.canvas_url && <p className="mt-4 text-xs text-muted">Ce morceau n'a pas de canvas.</p>}
        </div>
      </div>
    </div>
  );
}

/** Panneaux latéraux coulissants (file d'attente / paroles) au-dessus du lecteur. */
export function SidePanels() {
  const { panel, setPanel } = usePlayer();

  return (
    <AnimatePresence>
      {panel !== 'none' && (
        <motion.aside
          key="panel"
          initial={{ x: '100%', opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.6 }}
          transition={{ type: 'spring', stiffness: 320, damping: 36 }}
          className="glass fixed right-0 top-0 z-40 hidden w-[420px] flex-col border-l border-line shadow-soft md:flex"
          style={{ bottom: 'calc(var(--player-h) + var(--mnav-h))' }}
        >
          <div className="flex items-center gap-1 border-b border-line px-3 py-3">
            <div className="flex flex-1 gap-1 rounded-full bg-card p-1">
              {(
                [
                  ['queue', "File d'attente", <ListMusic key="q" size={15} />],
                  ['lyrics', 'Paroles', <AlignLeft key="l" size={15} />],
                  ['canvas', 'En lecture', <Film key="c" size={15} />],
                ] as const
              ).map(([id, label, icon]) => (
                <button
                  key={id}
                  onClick={() => setPanel(id)}
                  className={`relative flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                    panel === id ? 'text-onaccent' : 'text-muted hover:text-fg'
                  }`}
                >
                  {panel === id && (
                    <motion.span layoutId="panel-tab" className="absolute inset-0 rounded-full bg-accent-gradient" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />
                  )}
                  <span className="relative flex items-center gap-2">
                    {icon}
                    {label}
                  </span>
                </button>
              ))}
            </div>
            <button className="icon-btn h-9 w-9 hover:bg-hover" onClick={() => setPanel('none')} aria-label="Fermer le panneau">
              <X size={18} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {panel === 'queue' ? <QueueContent /> : panel === 'lyrics' ? <LyricsContent /> : <NowPlayingContent />}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
