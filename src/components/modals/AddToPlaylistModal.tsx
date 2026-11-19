import { useState } from 'react';
import { ListMusic, Plus } from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';
import { Modal } from '../ui/Modal';
import { PlaylistCover } from '../ui/Cover';

export function AddToPlaylistModal() {
  const { pickerTrack, closePlaylistPicker, playlists, addToPlaylist, createPlaylist } = useLibrary();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickerTrack || !title.trim()) return;
    setBusy(true);
    const created = await createPlaylist(title);
    if (created) {
      await addToPlaylist(created, pickerTrack.id);
      setTitle('');
      closePlaylistPicker();
    }
    setBusy(false);
  };

  return (
    <Modal open={!!pickerTrack} onClose={closePlaylistPicker} title="Ajouter à une playlist" size="sm">
      <div className="px-5 py-5">
        {pickerTrack && (
          <p className="mb-4 truncate text-sm text-muted">
            Titre : <span className="font-semibold text-fg">{pickerTrack.title}</span>
          </p>
        )}

        <form onSubmit={create} className="mb-4 flex gap-2">
          <input
            className="field"
            placeholder="Nouvelle playlist…"
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button className="btn btn-primary !px-4" disabled={!title.trim() || busy} aria-label="Créer et ajouter">
            <Plus size={18} />
          </button>
        </form>

        <div className="max-h-72 space-y-1 overflow-y-auto">
          {playlists.length === 0 && <p className="py-6 text-center text-sm text-muted">Vous n'avez pas encore de playlist. Créez-en une ci-dessus.</p>}
          {playlists.map((p) => (
            <button
              key={p.id}
              onClick={async () => {
                if (!pickerTrack) return;
                await addToPlaylist(p, pickerTrack.id);
                closePlaylistPicker();
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-card"
            >
              <PlaylistCover cover={p.cover_url} mosaic={p.mosaic} title={p.title} className="h-11 w-11 !shadow-none" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{p.title}</span>
                <span className="flex items-center gap-1 text-xs text-muted">
                  <ListMusic size={12} /> {p.track_count} titre{p.track_count > 1 ? 's' : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
