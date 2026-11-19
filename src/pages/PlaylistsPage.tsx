import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ListMusic, Plus } from 'lucide-react';
import { useDocumentTitle } from '../lib/hooks';
import { useLibrary } from '../context/LibraryContext';
import { AuthGate } from '../components/AuthGate';
import { PlaylistCover } from '../components/ui/Cover';
import { EmptyState } from '../components/ui/Misc';

function PlaylistsContent() {
  const { playlists, createPlaylist } = useLibrary();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    const created = await createPlaylist(title);
    setBusy(false);
    if (created) {
      setTitle('');
      navigate(`/playlist/${created.id}`);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Playlists</h1>
          <p className="mt-2 text-muted">Vos sélections personnelles, rien qu'à vous.</p>
        </div>
        <form onSubmit={create} className="flex w-full gap-2 sm:w-auto">
          <input className="field sm:w-72" placeholder="Nom de la nouvelle playlist…" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn btn-primary" disabled={!title.trim() || busy}>
            <Plus size={17} /> Créer
          </button>
        </form>
      </header>

      {playlists.length === 0 ? (
        <EmptyState icon={<ListMusic size={26} />} title="Aucune playlist" text="Créez votre première playlist, puis ajoutez des titres depuis le menu « … » de n'importe quel morceau." />
      ) : (
        <div className="grid grid-cols-2 gap-x-[var(--card-gap)] gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {playlists.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.04 }}>
              <Link to={`/playlist/${p.id}`} className="group block">
                <div className="transition-transform duration-300 group-hover:-translate-y-1">
                  <PlaylistCover cover={p.cover_url} mosaic={p.mosaic} title={p.title} className="w-full" />
                </div>
                <p className="mt-3 truncate text-sm font-semibold group-hover:underline">{p.title}</p>
                <p className="text-xs text-muted">
                  {p.track_count} titre{p.track_count > 1 ? 's' : ''}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlaylistsPage() {
  useDocumentTitle('Playlists');
  return (
    <AuthGate reason="Connectez-vous pour créer et gérer vos playlists.">
      <PlaylistsContent />
    </AuthGate>
  );
}
