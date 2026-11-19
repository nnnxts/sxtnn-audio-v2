import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { PlaylistSummary, Track } from '../lib/types';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface LibraryApi {
  likedIds: Set<number>;
  followedIds: Set<number>;
  playlists: PlaylistSummary[];
  isLiked: (trackId: number) => boolean;
  isFollowing: (artistId: number) => boolean;
  toggleLike: (track: Pick<Track, 'id' | 'title'>) => Promise<void>;
  toggleFollow: (artistId: number) => Promise<{ following: boolean; followers: number } | null>;
  refreshPlaylists: () => Promise<void>;
  createPlaylist: (title: string) => Promise<PlaylistSummary | null>;
  addToPlaylist: (playlist: PlaylistSummary, trackId: number) => Promise<void>;
  /** Fenêtre "Ajouter à une playlist" */
  pickerTrack: Track | null;
  openPlaylistPicker: (track: Track) => void;
  closePlaylistPicker: () => void;
}

const LibraryContext = createContext<LibraryApi | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { user, requireAuth } = useAuth();
  const { toast, error } = useToast();
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [followedIds, setFollowedIds] = useState<Set<number>>(new Set());
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [pickerTrack, setPickerTrack] = useState<Track | null>(null);

  useEffect(() => {
    if (!user) {
      setLikedIds(new Set());
      setFollowedIds(new Set());
      setPlaylists([]);
      return;
    }
    let alive = true;
    api
      .get<{ like_ids: number[]; follow_ids: number[]; playlists: PlaylistSummary[] }>('/me/library')
      .then((res) => {
        if (!alive) return;
        setLikedIds(new Set(res.like_ids));
        setFollowedIds(new Set(res.follow_ids));
        setPlaylists(res.playlists);
      })
      .catch(() => {
        /* silencieux : l'interface reste utilisable */
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const refreshPlaylists = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<{ playlists: PlaylistSummary[] }>('/playlists');
      setPlaylists(res.playlists);
    } catch {
      /* ignoré */
    }
  }, [user]);

  const toggleLike = useCallback(
    async (track: Pick<Track, 'id' | 'title'>) => {
      if (!requireAuth('Connectez-vous pour ajouter ce titre à vos coups de cœur.')) return;
      const was = likedIds.has(track.id);
      // Mise à jour optimiste
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (was) next.delete(track.id);
        else next.add(track.id);
        return next;
      });
      try {
        const res = await api.post<{ liked: boolean }>(`/tracks/${track.id}/like`);
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (res.liked) next.add(track.id);
          else next.delete(track.id);
          return next;
        });
        if (res.liked) toast(`« ${track.title} » ajouté à vos coups de cœur`, 'success');
      } catch (e) {
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (was) next.add(track.id);
          else next.delete(track.id);
          return next;
        });
        error((e as Error).message);
      }
    },
    [likedIds, requireAuth, toast, error]
  );

  const toggleFollow = useCallback(
    async (artistId: number) => {
      if (!requireAuth('Connectez-vous pour suivre vos artistes préférés.')) return null;
      try {
        const res = await api.post<{ following: boolean; followers: number }>(`/artists/${artistId}/follow`);
        setFollowedIds((prev) => {
          const next = new Set(prev);
          if (res.following) next.add(artistId);
          else next.delete(artistId);
          return next;
        });
        return res;
      } catch (e) {
        error((e as Error).message);
        return null;
      }
    },
    [requireAuth, error]
  );

  const createPlaylist = useCallback(
    async (title: string) => {
      if (!requireAuth('Connectez-vous pour créer des playlists.')) return null;
      const clean = title.trim();
      if (!clean) return null;
      try {
        const res = await api.post<{ playlist: PlaylistSummary }>('/playlists', { title: clean });
        setPlaylists((prev) => [res.playlist, ...prev]);
        toast(`Playlist « ${res.playlist.title} » créée`, 'success');
        return res.playlist;
      } catch (e) {
        error((e as Error).message);
        return null;
      }
    },
    [requireAuth, toast, error]
  );

  const addToPlaylist = useCallback(
    async (playlist: PlaylistSummary, trackId: number) => {
      try {
        const res = await api.post<{ added: boolean; already?: boolean }>(`/playlists/${playlist.id}/tracks`, { track_id: trackId });
        if (res.already) toast(`Déjà dans « ${playlist.title} »`, 'info');
        else toast(`Ajouté à « ${playlist.title} »`, 'success');
        refreshPlaylists();
      } catch (e) {
        error((e as Error).message);
      }
    },
    [toast, error, refreshPlaylists]
  );

  const openPlaylistPicker = useCallback(
    (track: Track) => {
      if (!requireAuth('Connectez-vous pour utiliser vos playlists.')) return;
      setPickerTrack(track);
    },
    [requireAuth]
  );

  const value = useMemo<LibraryApi>(
    () => ({
      likedIds,
      followedIds,
      playlists,
      isLiked: (id) => likedIds.has(id),
      isFollowing: (id) => followedIds.has(id),
      toggleLike,
      toggleFollow,
      refreshPlaylists,
      createPlaylist,
      addToPlaylist,
      pickerTrack,
      openPlaylistPicker,
      closePlaylistPicker: () => setPickerTrack(null),
    }),
    [likedIds, followedIds, playlists, toggleLike, toggleFollow, refreshPlaylists, createPlaylist, addToPlaylist, pickerTrack, openPlaylistPicker]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryApi {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary doit être utilisé dans <LibraryProvider>');
  return ctx;
}
