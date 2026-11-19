import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { Track } from '../lib/types';
import { trackMainNames } from '../lib/format';
import { useToast } from './ToastContext';

/* ============================================================
 * Lecteur audio GLOBAL.
 * Il vit au-dessus du routeur : changer de page ne l'interrompt jamais.
 * Deux contextes : l'un pour l'état (rare), l'autre pour le temps (4 fois / seconde).
 * ============================================================ */

export type RepeatMode = 'off' | 'all' | 'one';
export type PanelKind = 'none' | 'queue' | 'lyrics' | 'canvas';
/** Vues du lecteur plein écran (mobile) ; null = fermé */
export type FullPlayerView = 'player' | 'queue' | 'lyrics';

export interface QueueItem {
  uid: string;
  track: Track;
}

interface PlayerApi {
  queue: QueueItem[];
  current: QueueItem | null;
  currentTrack: Track | null;
  isPlaying: boolean;
  buffering: boolean;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  panel: PanelKind;
  fullPlayer: FullPlayerView | null;
  /** Compteurs d'écoute mis à jour en direct (id de piste -> nombre) */
  playCounts: Record<number, number>;

  playTracks: (tracks: Track[], startIndex?: number) => void;
  playShuffled: (tracks: Track[]) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;

  addToQueue: (tracks: Track | Track[]) => void;
  playNext: (track: Track) => void;
  removeFromQueue: (uid: string) => void;
  reorderQueue: (items: QueueItem[]) => void;
  clearQueue: () => void;
  playQueueItem: (uid: string) => void;

  openFullPlayer: (view?: FullPlayerView) => void;
  closeFullPlayer: () => void;
  setPanel: (panel: PanelKind) => void;
  togglePanel: (panel: Exclude<PanelKind, 'none'>) => void;
}

interface TimeApi {
  currentTime: number;
  duration: number;
}

const PlayerContext = createContext<PlayerApi | null>(null);
const TimeContext = createContext<TimeApi>({ currentTime: 0, duration: 0 });

const PREFS_KEY = 'sxtnn.player';
const LISTEN_THRESHOLD_SECONDS = 10;

let uidCounter = 0;
const newUid = () => `q${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

interface Prefs {
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
}

function loadPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') as Partial<Prefs>;
    return {
      volume: typeof raw.volume === 'number' ? Math.min(1, Math.max(0, raw.volume)) : 0.8,
      muted: !!raw.muted,
      shuffle: !!raw.shuffle,
      repeat: raw.repeat === 'all' || raw.repeat === 'one' ? raw.repeat : 'off',
    };
  } catch {
    return { volume: 0.8, muted: false, shuffle: false, repeat: 'off' };
  }
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A' || el.isContentEditable;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { error } = useToast();
  const errorRef = useRef(error);
  errorRef.current = error;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (audioRef.current === null && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata';
  }

  const initial = useMemo(loadPrefs, []);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(initial.volume);
  const [muted, setMuted] = useState(initial.muted);
  const [shuffle, setShuffle] = useState(initial.shuffle);
  const [repeat, setRepeat] = useState<RepeatMode>(initial.repeat);
  const [panel, setPanel] = useState<PanelKind>('none');
  const [fullPlayer, setFullPlayer] = useState<FullPlayerView | null>(null);
  const [playCounts, setPlayCounts] = useState<Record<number, number>>({});

  // Valeurs "vivantes" lisibles depuis les écouteurs d'événements sans closure périmée
  const live = useRef({ queue, currentUid, shuffle, repeat });
  live.current = { queue, currentUid, shuffle, repeat };
  const playedRef = useRef<Set<string>>(new Set());
  const historyRef = useRef<string[]>([]);
  const listenRef = useRef({ trackId: 0, seconds: 0, last: 0, counted: false });

  const current = useMemo(() => queue.find((q) => q.uid === currentUid) ?? null, [queue, currentUid]);
  const currentTrack = current?.track ?? null;

  /* ---------- Démarrer un élément de la file ---------- */
  const startItem = useCallback((item: QueueItem, pushHistory = true) => {
    const audio = audioRef.current;
    if (!audio) return;
    const prev = live.current.currentUid;
    if (pushHistory && prev && prev !== item.uid) historyRef.current.push(prev);
    playedRef.current.add(item.uid);
    listenRef.current = { trackId: item.track.id, seconds: 0, last: 0, counted: false };

    live.current.currentUid = item.uid;
    setCurrentUid(item.uid);
    setCurrentTime(0);
    setDuration(item.track.duration_seconds || 0);
    setBuffering(true);

    audio.src = item.track.audio_url;
    const p = audio.play();
    if (p) p.catch(() => setIsPlaying(false));
  }, []);

  /* ---------- Piste suivante ---------- */
  const goNext = useCallback(
    (auto: boolean) => {
      const audio = audioRef.current;
      if (!audio) return;
      const { queue: q, currentUid: uid, shuffle: sh, repeat: rep } = live.current;
      if (!q.length) return;

      if (auto && rep === 'one') {
        listenRef.current = { ...listenRef.current, seconds: 0, last: 0, counted: false };
        audio.currentTime = 0;
        const p = audio.play();
        if (p) p.catch(() => setIsPlaying(false));
        return;
      }

      const idx = q.findIndex((i) => i.uid === uid);
      let nextItem: QueueItem | null = null;

      if (sh) {
        if (uid) playedRef.current.add(uid);
        let pool = q.filter((i) => !playedRef.current.has(i.uid));
        if (!pool.length) {
          if (rep === 'all' || !auto) {
            playedRef.current = new Set(uid ? [uid] : []);
            pool = q.filter((i) => i.uid !== uid);
            if (!pool.length) pool = q;
          } else {
            audio.pause();
            audio.currentTime = 0;
            setIsPlaying(false);
            return;
          }
        }
        nextItem = pool[Math.floor(Math.random() * pool.length)];
      } else if (idx >= 0 && idx < q.length - 1) {
        nextItem = q[idx + 1];
      } else if (rep === 'all' || !auto) {
        nextItem = q[0];
      } else {
        // Fin de la file en mode "répétition désactivée" : on s'arrête sur le dernier titre
        audio.pause();
        audio.currentTime = 0;
        setIsPlaying(false);
        return;
      }
      startItem(nextItem);
    },
    [startItem]
  );
  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;

  /* ---------- Piste précédente ---------- */
  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const { queue: q, currentUid: uid, shuffle: sh, repeat: rep } = live.current;
    if (!q.length) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    if (sh) {
      while (historyRef.current.length) {
        const last = historyRef.current.pop() as string;
        const item = q.find((i) => i.uid === last);
        if (item && item.uid !== uid) return startItem(item, false);
      }
      audio.currentTime = 0;
      return;
    }
    const idx = q.findIndex((i) => i.uid === uid);
    if (idx > 0) return startItem(q[idx - 1], false);
    if (rep === 'all') return startItem(q[q.length - 1], false);
    audio.currentTime = 0;
  }, [startItem]);

  /* ---------- Écouteurs audio (une seule fois) ---------- */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const reportPlay = (trackId: number) => {
      api
        .post<{ id: number; play_count: number }>(`/tracks/${trackId}/play`)
        .then((res) => setPlayCounts((prev) => ({ ...prev, [res.id]: res.play_count })))
        .catch(() => {
          /* le compteur sera retenté à la prochaine écoute */
        });
    };

    const onTime = () => {
      const now = audio.currentTime;
      setCurrentTime(now);
      const l = listenRef.current;
      const delta = now - l.last;
      l.last = now;
      // On ne compte que l'écoute continue (les sauts dans la barre de temps sont ignorés)
      if (!audio.paused && delta > 0 && delta < 1.6) l.seconds += delta;
      if (!l.counted && l.trackId && l.seconds >= LISTEN_THRESHOLD_SECONDS) {
        l.counted = true;
        reportPlay(l.trackId);
      }
    };
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onPlaying = () => {
      setIsPlaying(true);
      setBuffering(false);
    };
    const onWaiting = () => setBuffering(true);
    const onCanPlay = () => setBuffering(false);
    const onEnded = () => goNextRef.current(true);
    const onError = () => {
      setBuffering(false);
      setIsPlaying(false);
      if (audio.getAttribute('src')) errorRef.current('Impossible de lire ce titre (fichier introuvable ou illisible).');
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onMeta);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onMeta);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  /* ---------- Volume / préférences ---------- */
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
      audio.muted = muted;
    }
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ volume, muted, shuffle, repeat }));
    } catch {
      /* ignoré */
    }
  }, [volume, muted, shuffle, repeat]);

  /* ---------- Actions ---------- */
  const playTracks = useCallback(
    (tracks: Track[], startIndex = 0) => {
      if (!tracks.length) return;
      const items = tracks.map((t) => ({ uid: newUid(), track: t }));
      const idx = Math.min(Math.max(startIndex, 0), items.length - 1);
      playedRef.current = new Set();
      historyRef.current = [];
      live.current.queue = items;
      setQueue(items);
      startItem(items[idx], false);
    },
    [startItem]
  );

  const playShuffled = useCallback(
    (tracks: Track[]) => {
      if (!tracks.length) return;
      setShuffle(true);
      live.current.shuffle = true;
      playTracks(tracks, Math.floor(Math.random() * tracks.length));
    },
    [playTracks]
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const { queue: q, currentUid: uid } = live.current;
    if (!uid) {
      if (q.length) startItem(q[0], false);
      return;
    }
    if (audio.paused) {
      const p = audio.play();
      if (p) p.catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [startItem]);

  const next = useCallback(() => goNext(false), [goNext]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    audio.currentTime = Math.max(0, seconds);
    listenRef.current.last = audio.currentTime;
    setCurrentTime(audio.currentTime);
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolumeState(clamped);
    setMuted(clamped === 0);
  }, []);

  const toggleMute = useCallback(() => {
    if (muted && volume === 0) setVolumeState(0.5);
    setMuted(!muted);
  }, [muted, volume]);

  const toggleShuffle = useCallback(() => {
    playedRef.current = new Set(live.current.currentUid ? [live.current.currentUid] : []);
    setShuffle(!live.current.shuffle);
  }, []);

  const cycleRepeat = useCallback(() => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')), []);

  const addToQueue = useCallback(
    (tracks: Track | Track[]) => {
      const list = Array.isArray(tracks) ? tracks : [tracks];
      if (!list.length) return;
      const items = list.map((t) => ({ uid: newUid(), track: t }));
      const merged = [...live.current.queue, ...items];
      live.current.queue = merged;
      setQueue(merged);
      if (!live.current.currentUid) startItem(items[0], false);
    },
    [startItem]
  );

  const playNext = useCallback(
    (track: Track) => {
      const item: QueueItem = { uid: newUid(), track };
      const { queue: q, currentUid: uid } = live.current;
      const idx = q.findIndex((i) => i.uid === uid);
      const merged = idx < 0 ? [...q, item] : [...q.slice(0, idx + 1), item, ...q.slice(idx + 1)];
      live.current.queue = merged;
      setQueue(merged);
      if (!uid) startItem(item, false);
    },
    [startItem]
  );

  const removeFromQueue = useCallback(
    (uid: string) => {
      const audio = audioRef.current;
      const { queue: q, currentUid } = live.current;
      const idx = q.findIndex((i) => i.uid === uid);
      if (idx < 0) return;
      const nextQueue = q.filter((i) => i.uid !== uid);
      playedRef.current.delete(uid);

      if (uid !== currentUid) {
        live.current.queue = nextQueue;
        setQueue(nextQueue);
        return;
      }
      if (!nextQueue.length) {
        if (audio) {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        }
        live.current.queue = [];
        live.current.currentUid = null;
        setQueue([]);
        setCurrentUid(null);
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        return;
      }
      live.current.queue = nextQueue;
      setQueue(nextQueue);
      startItem(nextQueue[Math.min(idx, nextQueue.length - 1)], false);
    },
    [startItem]
  );

  const reorderQueue = useCallback((items: QueueItem[]) => {
    live.current.queue = items;
    setQueue(items);
  }, []);

  const clearQueue = useCallback(() => {
    const { queue: q, currentUid } = live.current;
    const keep = q.filter((i) => i.uid === currentUid);
    live.current.queue = keep;
    setQueue(keep);
    playedRef.current = new Set(keep.map((k) => k.uid));
  }, []);

  const playQueueItem = useCallback(
    (uid: string) => {
      const item = live.current.queue.find((i) => i.uid === uid);
      if (!item) return;
      if (item.uid === live.current.currentUid) return togglePlay();
      startItem(item);
    },
    [startItem, togglePlay]
  );

  const openFullPlayer = useCallback((view: FullPlayerView = 'player') => setFullPlayer(view), []);
  const closeFullPlayer = useCallback(() => setFullPlayer(null), []);
  const togglePanel = useCallback((kind: Exclude<PanelKind, 'none'>) => setPanel((p) => (p === kind ? 'none' : kind)), []);

  /* ---------- Raccourci clavier : Espace = lecture / pause ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (!live.current.currentUid) return;
      e.preventDefault();
      togglePlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay]);

  /* ---------- Contrôles système (écran verrouillé, touches média, notification) ---------- */
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    if (!currentTrack) {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: trackMainNames(currentTrack),
      album: currentTrack.release_title,
      artwork: currentTrack.cover_url ? [{ src: `${window.location.origin}${currentTrack.cover_url}`, sizes: '512x512' }] : [],
    });
  }, [currentTrack]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* action non supportée */
      }
    };
    set('play', () => audioRef.current?.play().catch(() => undefined));
    set('pause', () => audioRef.current?.pause());
    set('previoustrack', () => prev());
    set('nexttrack', () => goNextRef.current(false));
    set('seekto', (d) => {
      if (typeof d.seekTime === 'number') seek(d.seekTime);
    });
    return () => {
      (['play', 'pause', 'previoustrack', 'nexttrack', 'seekto'] as MediaSessionAction[]).forEach((a) => set(a, null));
    };
  }, [prev, seek]);

  useEffect(() => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  /* ---------- Valeur du contexte ---------- */
  const value = useMemo<PlayerApi>(
    () => ({
      queue,
      current,
      currentTrack,
      isPlaying,
      buffering,
      volume,
      muted,
      shuffle,
      repeat,
      panel,
      fullPlayer,
      playCounts,
      playTracks,
      playShuffled,
      togglePlay,
      next,
      prev,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      addToQueue,
      playNext,
      removeFromQueue,
      reorderQueue,
      clearQueue,
      playQueueItem,
      openFullPlayer,
      closeFullPlayer,
      setPanel,
      togglePanel,
    }),
    [
      queue,
      current,
      currentTrack,
      isPlaying,
      buffering,
      volume,
      muted,
      shuffle,
      repeat,
      panel,
      fullPlayer,
      playCounts,
      playTracks,
      playShuffled,
      togglePlay,
      next,
      prev,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      addToQueue,
      playNext,
      removeFromQueue,
      reorderQueue,
      clearQueue,
      playQueueItem,
      openFullPlayer,
      closeFullPlayer,
      togglePanel,
    ]
  );

  const timeValue = useMemo<TimeApi>(() => ({ currentTime, duration }), [currentTime, duration]);

  return (
    <PlayerContext.Provider value={value}>
      <TimeContext.Provider value={timeValue}>{children}</TimeContext.Provider>
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer doit être utilisé dans <PlayerProvider>');
  return ctx;
}

export function usePlayerTime(): TimeApi {
  return useContext(TimeContext);
}
