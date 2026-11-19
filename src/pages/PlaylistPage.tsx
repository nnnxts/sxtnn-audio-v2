import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Reorder, useDragControls } from 'framer-motion';
import { Camera, GripVertical, ListMusic, Loader2, Pause, Pencil, Play, Shuffle, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useApi, useDocumentTitle } from '../lib/hooks';
import type { PlaylistSummary, Track } from '../lib/types';
import { formatTotalDuration } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { useToast } from '../context/ToastContext';
import { AuthGate } from '../components/AuthGate';
import { PlaylistCover } from '../components/ui/Cover';
import { EmptyState, ErrorState, RowsSkeleton } from '../components/ui/Misc';
import { Modal } from '../components/ui/Modal';
import { TrackRow } from '../components/TrackRow';

interface PlaylistData {
  playlist: PlaylistSummary;
  tracks: Track[];
}

function DraggableRow({
  track,
  tracks,
  index,
  onRemove,
}: {
  track: Track;
  tracks: Track[];
  index: number;
  onRemove: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={track}
      dragListener={false}
      dragControls={controls}
      className="relative list-none"
      whileDrag={{ scale: 1.01, boxShadow: '0 16px 40px -12px rgba(0,0,0,.65)', zIndex: 5, borderRadius: 16, backgroundColor: 'rgb(var(--card))' }}
    >
      <TrackRow
        track={track}
        tracks={tracks}
        index={index}
        lead="index"
        showCover
        showAlbum
        onRemove={onRemove}
        removeLabel="Retirer de cette playlist"
        handle={
          <button
            className="icon-btn hidden h-8 w-6 shrink-0 cursor-grab touch-none active:cursor-grabbing sm:inline-flex"
            aria-label="Déplacer le titre"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              e.stopPropagation();
              controls.start(e);
            }}
          >
            <GripVertical size={16} />
          </button>
        }
      />
    </Reorder.Item>
  );
}

function EditModal({
  playlist,
  open,
  onClose,
  onSaved,
}: {
  playlist: PlaylistSummary;
  open: boolean;
  onClose: () => void;
  onSaved: (p: PlaylistSummary) => void;
}) {
  const { error: toastError, success } = useToast();
  const [title, setTitle] = useState(playlist.title);
  const [description, setDescription] = useState(playlist.description);
  const [cover, setCover] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(playlist.title);
      setDescription(playlist.description);
      setCover(null);
      setRemoveCover(false);
    }
  }, [open, playlist]);

  useEffect(() => {
    if (!cover) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(cover);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const form = new FormData();
      form.append('title', title);
      form.append('description', description);
      if (cover) form.append('cover', cover);
      if (removeCover && !cover) form.append('remove_cover', 'true');
      const res = await api.patch<{ playlist: PlaylistSummary }>(`/playlists/${playlist.id}`, form);
      onSaved(res.playlist);
      success('Playlist mise à jour');
      onClose();
    } catch (err) {
      toastError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const shownCover = removeCover ? null : preview ?? playlist.cover_url;

  return (
    <Modal open={open} onClose={onClose} title="Modifier la playlist" size="md">
      <form onSubmit={save} className="space-y-5 px-6 py-6">
        <div className="flex items-center gap-5">
          <label className="group relative cursor-pointer">
            <PlaylistCover cover={shownCover} mosaic={removeCover || !preview ? playlist.mosaic : []} title={title} className="h-32 w-32" />
            <span className="absolute inset-0 grid place-items-center rounded-cover bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Camera size={24} />
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                setCover(e.target.files?.[0] ?? null);
                setRemoveCover(false);
              }}
            />
          </label>
          <div className="text-sm text-muted">
            <p>Cliquez sur la pochette pour la changer.</p>
            {(playlist.cover_url || cover) && (
              <button
                type="button"
                className="mt-2 font-semibold text-danger hover:underline"
                onClick={() => {
                  setCover(null);
                  setRemoveCover(true);
                }}
              >
                Revenir à la mosaïque automatique
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="label">Nom</label>
          <input className="field" value={title} maxLength={80} required onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="field min-h-[96px] resize-y" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" disabled={busy || !title.trim()}>
            {busy && <Loader2 size={16} className="animate-spin" />} Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PlaylistContent() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { refreshPlaylists } = useLibrary();
  const { currentTrack, isPlaying, playTracks, playShuffled, togglePlay } = usePlayer();
  const { error: toastError, success } = useToast();
  const { data, loading, error, reload } = useApi<PlaylistData>(`/playlists/${id}`, [id, user?.id]);

  const [playlist, setPlaylist] = useState<PlaylistSummary | null>(null);
  const [items, setItems] = useState<Track[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const saveTimer = useRef<number | null>(null);

  useDocumentTitle(playlist?.title);

  useEffect(() => {
    if (data) {
      setPlaylist(data.playlist);
      setItems(data.tracks);
    }
  }, [data]);

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    },
    []
  );

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data) return <RowsSkeleton count={7} />;
  if (!playlist) return null;

  const total = items.reduce((s, t) => s + t.duration_seconds, 0);
  const inList = !!currentTrack && items.some((t) => t.id === currentTrack.id);
  const playing = inList && isPlaying;

  const onReorder = (next: Track[]) => {
    setItems(next);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      api
        .put(`/playlists/${playlist.id}/order`, { track_ids: next.map((t) => t.id) })
        .catch((e: Error) => toastError(e.message));
    }, 500);
  };

  const removeTrack = async (track: Track) => {
    try {
      await api.del(`/playlists/${playlist.id}/tracks/${track.id}`);
      setItems((list) => list.filter((t) => t.id !== track.id));
      refreshPlaylists();
    } catch (e) {
      toastError((e as Error).message);
    }
  };

  const deletePlaylist = async () => {
    try {
      await api.del(`/playlists/${playlist.id}`);
      await refreshPlaylists();
      success('Playlist supprimée');
      navigate('/library');
    } catch (e) {
      toastError((e as Error).message);
    }
  };

  return (
    <div className="space-y-8">
      <header className="relative isolate overflow-hidden rounded-[28px] border border-line/60 p-6 sm:p-10">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-accent/45 via-accent2/20 to-transparent" />
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end">
          <PlaylistCover cover={playlist.cover_url} mosaic={playlist.mosaic} title={playlist.title} className="h-48 w-48 shrink-0 sm:h-56 sm:w-56" />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-fg/80">Playlist</p>
            <h1 className="mt-1 break-words font-display text-4xl font-extrabold tracking-tight sm:text-6xl">{playlist.title}</h1>
            {playlist.description && <p className="mt-3 max-w-2xl text-sm text-fg/80">{playlist.description}</p>}
            <p className="mt-3 text-sm text-fg/80">
              {user?.username} · {items.length} titre{items.length > 1 ? 's' : ''}
              {total > 0 && `, ${formatTotalDuration(total)}`}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <button className="btn btn-primary !px-6 !py-3.5" disabled={!items.length} onClick={() => (inList ? togglePlay() : playTracks(items, 0))}>
                {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                {playing ? 'Pause' : 'Lecture'}
              </button>
              <button className="btn btn-ghost !bg-white/10 !py-3.5 backdrop-blur hover:!bg-white/20" disabled={!items.length} onClick={() => playShuffled(items)}>
                <Shuffle size={17} /> Aléatoire
              </button>
              <button className="btn btn-ghost !bg-white/10 !py-3.5 backdrop-blur hover:!bg-white/20" onClick={() => setEditOpen(true)}>
                <Pencil size={16} /> Modifier
              </button>
              <button className="icon-btn h-11 w-11 bg-white/10 hover:!text-danger" onClick={() => setDeleteOpen(true)} aria-label="Supprimer la playlist" title="Supprimer la playlist">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon={<ListMusic size={26} />}
          title="Cette playlist est vide"
          text="Ajoutez des titres via le menu « … » ou le bouton « Ajouter à une playlist » du lecteur."
          action={
            <Link to="/explore" className="btn btn-primary">
              Trouver de la musique
            </Link>
          }
        />
      ) : (
        <Reorder.Group axis="y" values={items} onReorder={onReorder} className="space-y-0.5">
          {items.map((t, i) => (
            <DraggableRow key={t.id} track={t} tracks={items} index={i} onRemove={() => removeTrack(t)} />
          ))}
        </Reorder.Group>
      )}

      <EditModal playlist={playlist} open={editOpen} onClose={() => setEditOpen(false)} onSaved={(p) => { setPlaylist(p); refreshPlaylists(); }} />

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Supprimer cette playlist ?" size="sm">
        <div className="space-y-5 px-6 py-6">
          <p className="text-sm text-muted">
            « {playlist.title} » sera supprimée définitivement. Les titres restent disponibles dans le catalogue.
          </p>
          <div className="flex justify-end gap-3">
            <button className="btn btn-ghost" onClick={() => setDeleteOpen(false)}>
              Annuler
            </button>
            <button className="btn btn-danger" onClick={deletePlaylist}>
              <Trash2 size={16} /> Supprimer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function PlaylistPage() {
  return (
    <AuthGate reason="Connectez-vous pour accéder à vos playlists.">
      <PlaylistContent />
    </AuthGate>
  );
}
