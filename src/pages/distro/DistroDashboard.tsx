import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, LogOut, Rocket, UserRound, Library, Users } from 'lucide-react';
import { api, tokens } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import type { Artist } from '../../lib/types';
import { useToast } from '../../context/ToastContext';
import { Avatar } from '../../components/ui/Cover';
import { VerifiedBadge } from '../../components/ui/Badges';
import { Skeleton } from '../../components/ui/Misc';
import { ReleaseForm } from '../../components/distro/ReleaseForm';
import { ProfileTab } from './ProfileTab';
import { CatalogTab } from './CatalogTab';
import { FriendsTab } from './FriendsTab';
import { useForcedDarkTheme } from './useDistro';

type Tab = 'profile' | 'publish' | 'catalog' | 'friends';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profil Artiste', icon: <UserRound size={16} /> },
  { id: 'publish', label: 'Publier une sortie', icon: <Rocket size={16} /> },
  { id: 'catalog', label: 'Catalogue & Gestion', icon: <Library size={16} /> },
  { id: 'friends', label: 'Amis', icon: <Users size={16} /> },
];

export default function DistroDashboard() {
  useForcedDarkTheme();
  useDocumentTitle('Tableau de bord · Distributeur');
  const navigate = useNavigate();
  const { success } = useToast();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [tab, setTab] = useState<Tab>('profile');
  const [catalogKey, setCatalogKey] = useState(0);
  const [publishKey, setPublishKey] = useState(0);

  const leave = useCallback(() => {
    tokens.setArtist(null);
    navigate('/distro', { replace: true });
  }, [navigate]);

  // Vérifie la session artiste
  useEffect(() => {
    if (!tokens.getArtist()) {
      navigate('/distro', { replace: true });
      return;
    }
    let alive = true;
    api
      .get<{ artist: Artist }>('/distro/me')
      .then((res) => alive && setArtist(res.artist))
      .catch(() => alive && leave());
    return () => {
      alive = false;
    };
  }, [navigate, leave]);

  // Session expirée pendant l'utilisation
  useEffect(() => {
    const onUnauthorized = (e: Event) => {
      if ((e as CustomEvent<{ kind: string }>).detail?.kind === 'artist') leave();
    };
    window.addEventListener('sxtnn:unauthorized', onUnauthorized);
    return () => window.removeEventListener('sxtnn:unauthorized', onUnauthorized);
  }, [leave]);

  return (
    <div className="relative isolate min-h-screen bg-bg text-fg" style={{ paddingBottom: 'calc(var(--player-h) + var(--mnav-h) + 3rem)' }}>
      <div className="pointer-events-none absolute -left-40 -top-40 -z-10 h-[460px] w-[460px] rounded-full bg-accent/15 blur-[120px]" />

      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
        {/* En-tête */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
          <div className="flex min-w-0 items-center gap-4">
            {artist ? <Avatar src={artist.avatar_url} name={artist.name} className="h-14 w-14" /> : <Skeleton className="h-14 w-14 !rounded-full" />}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">SXTNN DISTRO</p>
              {artist ? (
                <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold leading-tight tracking-tight">
                  <span className="truncate">Bienvenue, {artist.name}</span>
                  {artist.is_verified && <VerifiedBadge size={20} />}
                </h1>
              ) : (
                <Skeleton className="mt-1 h-7 w-52" />
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/" className="btn btn-ghost !py-2.5">
              <ArrowLeft size={16} /> Aller au site
            </Link>
            <button
              className="btn btn-danger !py-2.5"
              onClick={() => {
                leave();
                success('Vous avez quitté votre session artiste.');
              }}
            >
              <LogOut size={16} /> Changer d'artiste
            </button>
          </div>
        </header>

        {/* Onglets */}
        <nav className="mt-6 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`relative flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                  active ? 'text-onaccent' : 'text-muted hover:text-fg'
                }`}
              >
                {active && <motion.span layoutId="distro-tab" className="absolute inset-0 rounded-xl bg-accent-gradient shadow-glow" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
                <span className="relative flex items-center gap-2">
                  {t.icon}
                  {t.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Contenu */}
        <main className="mt-8">
          {!artist ? (
            <div className="space-y-4">
              <Skeleton className="h-64 w-full !rounded-3xl" />
              <Skeleton className="h-40 w-full !rounded-3xl" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {tab === 'profile' && <ProfileTab artist={artist} onUpdated={setArtist} />}
                {tab === 'publish' && (
                  <div>
                    <h2 className="mb-6 font-display text-xl font-bold">Publier une nouvelle sortie (Release)</h2>
                    <ReleaseForm
                      key={publishKey}
                      mode="create"
                      onSaved={() => {
                        success('Sortie publiée ! Elle est déjà en ligne sur SXTNN AUDIO.');
                        setPublishKey((k) => k + 1);
                        setCatalogKey((k) => k + 1);
                        setTab('catalog');
                      }}
                    />
                  </div>
                )}
                {tab === 'catalog' && <CatalogTab refreshKey={catalogKey} />}
                {tab === 'friends' && <FriendsTab />}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>
    </div>
  );
}
