import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Compass, Heart, Home, LibraryBig, ListMusic, LogIn, LogOut, Mic, Palette, Plus, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useTheme } from '../../context/ThemeContext';
import { Avatar, PlaylistCover } from '../ui/Cover';
import { tap } from '../../lib/haptics';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`group inline-flex items-center gap-2.5 ${className}`} aria-label="SXTNN AUDIO - Accueil">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-accent-gradient shadow-glow">
        <span className="flex h-4 items-end gap-[2px]">
          {[0.5, 1, 0.7, 0.9, 0.45].map((h, i) => (
            <span
              key={i}
              className="w-[2.5px] rounded-full bg-onaccent transition-transform duration-300 group-hover:scale-y-110"
              style={{ height: `${h * 100}%` }}
            />
          ))}
        </span>
      </span>
      <span className="font-display text-xl font-extrabold leading-none tracking-tight">
        SXTNN <span className="text-gradient">AUDIO</span>
      </span>
    </Link>
  );
}

function NavItem({ to, icon, label, end = false }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
          isActive ? 'text-fg' : 'text-muted hover:bg-card hover:text-fg'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="sidebar-active"
              className="absolute inset-0 rounded-xl bg-card ring-1 ring-line"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          )}
          {isActive && <motion.span layoutId="sidebar-bar" className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-accent-gradient" />}
          <span className={`relative ${isActive ? 'text-accent' : ''}`}>{icon}</span>
          <span className="relative">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const { user, logout, openAuth } = useAuth();
  const { playlists, createPlaylist } = useLibrary();
  const { openAppearance } = useTheme();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuth('Connectez-vous pour créer des playlists.');
      return;
    }
    const created = await createPlaylist(title);
    if (created) {
      setTitle('');
      navigate(`/playlist/${created.id}`);
    }
  };

  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w)] flex-col border-r border-line bg-surface/60 backdrop-blur-xl md:flex"
      style={{ paddingBottom: 'var(--player-h)' }}
    >
      <div className="px-5 pb-4 pt-6">
        <Logo />
      </div>

      <nav className="space-y-1 px-3">
        <NavItem to="/" end icon={<Home size={19} />} label="Accueil" />
        <NavItem to="/explore" icon={<Compass size={19} />} label="Explorer" />
      </nav>

      <p className="px-6 pb-2 pt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-muted/80">Bibliothèque</p>
      <nav className="space-y-1 px-3">
        <NavItem to="/likes" icon={<Heart size={19} />} label="Coups de cœur" />
        <NavItem to="/library" icon={<LibraryBig size={19} />} label="Playlists" />
      </nav>

      <p className="px-6 pb-2 pt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-muted/80">Vos playlists</p>
      <form onSubmit={submit} className="px-4 pb-2">
        <div className="relative">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => !user && openAuth('Connectez-vous pour créer des playlists.')}
            placeholder="Nouvelle playlist…"
            maxLength={80}
            className="w-full rounded-xl border border-line bg-card py-2 pl-3 pr-9 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            aria-label="Créer la playlist"
            className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-40"
          >
            <Plus size={16} />
          </button>
        </div>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {user && playlists.length === 0 && <p className="px-3 py-2 text-xs text-muted">Aucune playlist pour l'instant.</p>}
        {!user && <p className="px-3 py-2 text-xs text-muted">Connectez-vous pour créer vos playlists.</p>}
        {playlists.map((p) => (
          <NavLink
            key={p.id}
            to={`/playlist/${p.id}`}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${isActive ? 'bg-card text-fg' : 'text-muted hover:bg-card hover:text-fg'}`
            }
          >
            <PlaylistCover cover={p.cover_url} mosaic={p.mosaic} title={p.title} className="h-9 w-9 !shadow-none" />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{p.title}</span>
              <span className="flex items-center gap-1 text-[11px] text-muted">
                <ListMusic size={11} /> {p.track_count} titre{p.track_count > 1 ? 's' : ''}
              </span>
            </span>
          </NavLink>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-line px-4 py-3">
        {user ? (
          <>
            <Avatar src={user.avatar_url} name={user.username} className="h-9 w-9" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{user.username}</span>
              <span className="block truncate text-[11px] text-muted">{user.email}</span>
            </span>
          </>
        ) : (
          <button className="btn btn-ghost flex-1 !py-2.5" onClick={() => openAuth()}>
            <LogIn size={16} /> Se connecter
          </button>
        )}
        <button className="icon-btn h-9 w-9 hover:bg-card" onClick={openAppearance} aria-label="Apparence" title="Apparence">
          <Palette size={18} />
        </button>
        {user && (
          <button className="icon-btn h-9 w-9 hover:bg-card" onClick={logout} aria-label="Se déconnecter" title="Se déconnecter">
            <LogOut size={18} />
          </button>
        )}
      </div>
    </aside>
  );
}

/** Menu « Moi » : feuille qui monte du bas (compte, apparence, accès artiste, déconnexion). */
function MeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout, openAuth } = useAuth();
  const { openAppearance } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const run = (fn: () => void) => () => {
    onClose();
    window.setTimeout(fn, 120);
  };

  const rows: { icon: ReactNode; label: string; hint?: string; onClick: () => void; danger?: boolean }[] = [
    { icon: <Palette size={20} />, label: 'Apparence', hint: 'Thème, couleurs, pochettes', onClick: run(openAppearance) },
    { icon: <Mic size={20} />, label: 'Accès Artiste', hint: 'SXTNN DISTRO : publier ma musique', onClick: run(() => navigate('/distro')) },
  ];
  if (user) rows.push({ icon: <LogOut size={20} />, label: 'Se déconnecter', onClick: run(logout), danger: true });

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="me-backdrop"
            className="fixed inset-0 z-[70] bg-black/60 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="me-sheet"
            role="dialog"
            aria-label="Menu"
            className="fixed inset-x-0 bottom-0 z-[71] rounded-t-3xl border-t border-line bg-surface md:hidden"
            style={{ paddingBottom: 'max(var(--safe-bottom), 16px)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="mx-auto mb-3 mt-2.5 h-1 w-10 rounded-full bg-line" />

            <div className="px-5 pb-3">
              {user ? (
                <div className="flex items-center gap-3">
                  <Avatar src={user.avatar_url} name={user.username} className="h-14 w-14" />
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-bold">{user.username}</p>
                    <p className="text-sm text-muted">Compte auditeur</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-card p-4">
                  <p className="font-display text-lg font-bold">Rejoins SXTNN AUDIO</p>
                  <p className="mt-0.5 text-sm text-muted">Crée un compte pour liker des titres et faire tes playlists.</p>
                  <button className="btn btn-primary mt-3 w-full" onClick={run(() => openAuth())}>
                    <LogIn size={17} /> Connexion / Inscription
                  </button>
                </div>
              )}
            </div>

            <div className="px-2">
              {rows.map((r) => (
                <button
                  key={r.label}
                  onClick={r.onClick}
                  className={`flex w-full items-center gap-4 rounded-2xl px-3 py-3.5 text-left active:bg-card ${r.danger ? 'text-danger' : ''}`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card ${r.danger ? '' : 'text-accent'}`}>{r.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold">{r.label}</span>
                    {r.hint && <span className="block truncate text-xs text-muted">{r.hint}</span>}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Barre de navigation mobile (sous le lecteur) : 4 pages + « Moi ». */
export function MobileNav() {
  const [meOpen, setMeOpen] = useState(false);
  const { user } = useAuth();
  const { pathname } = useLocation();

  const items = [
    { to: '/', icon: Home, label: 'Accueil', end: true },
    { to: '/explore', icon: Compass, label: 'Explorer', end: false },
    { to: '/likes', icon: Heart, label: 'Cœurs', end: false },
    { to: '/library', icon: LibraryBig, label: 'Playlists', end: false },
  ];
  const isActive = (to: string, end: boolean) => (end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`) || (to === '/library' && pathname.startsWith('/playlist')));

  return (
    <>
      <nav
        className="glass fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-line md:hidden"
        style={{ height: 'var(--mnav-h)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {items.map((it) => {
          const active = isActive(it.to, it.end);
          const Icon = it.icon;
          return (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              onClick={() => tap(6)}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors active:scale-95 ${active ? 'text-accent' : 'text-muted'}`}
            >
              {active && <motion.span layoutId="mnav-indicator" className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-accent" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <Icon size={22} strokeWidth={active ? 2.4 : 2} fill={active && it.to === '/likes' ? 'currentColor' : 'none'} />
              {it.label}
            </NavLink>
          );
        })}
        <button
          onClick={() => {
            tap(6);
            setMeOpen(true);
          }}
          aria-label="Menu : compte et réglages"
          className="relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-muted transition-colors active:scale-95"
        >
          {user ? <Avatar src={user.avatar_url} name={user.username} className="h-[22px] w-[22px] !rounded-full" /> : <User size={22} />}
          Moi
        </button>
      </nav>
      <MeSheet open={meOpen} onClose={() => setMeOpen(false)} />
    </>
  );
}
