import { Link, useNavigate } from 'react-router-dom';
import { Heart, LibraryBig, LogIn, LogOut, Mic, Palette } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '../ui/Cover';
import { MenuButton } from '../ui/Menu';
import { SearchBox } from './SearchBox';
import { Logo } from './Sidebar';

export function Topbar() {
  const { user, logout, openAuth } = useAuth();
  const { openAppearance } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="glass sticky top-0 z-30 border-b border-line/70" style={{ paddingTop: 'var(--safe-top)' }}>
      <div className="flex items-center gap-3 px-4 py-2 sm:px-6 md:px-[var(--page-pad)] md:py-3">
        <Logo className="md:hidden [&>span:last-child]:hidden" />
        <div className="flex min-w-0 flex-1 justify-start">
          <SearchBox />
        </div>

        {/* Sur téléphone, compte / apparence / accès artiste sont dans l'onglet « Moi » */}
        <div className="hidden items-center gap-2 md:flex">
          <button className="icon-btn hidden h-10 w-10 hover:bg-card md:inline-flex" onClick={openAppearance} aria-label="Apparence" title="Apparence">
            <Palette size={19} />
          </button>

          {user ? (
            <MenuButton
              label="Mon compte"
              className="rounded-full ring-2 ring-transparent transition hover:ring-accent/60"
              items={[
                { label: 'Apparence', icon: <Palette size={16} />, onClick: openAppearance },
                { label: 'Coups de cœur', icon: <Heart size={16} />, onClick: () => navigate('/likes') },
                { label: 'Mes playlists', icon: <LibraryBig size={16} />, onClick: () => navigate('/library') },
                { label: 'Se déconnecter', icon: <LogOut size={16} />, onClick: logout, divider: true, danger: true },
              ]}
            >
              <Avatar src={user.avatar_url} name={user.username} className="h-10 w-10" />
            </MenuButton>
          ) : (
            <>
              <button className="icon-btn h-10 w-10 hover:bg-card md:hidden" onClick={openAppearance} aria-label="Apparence">
                <Palette size={19} />
              </button>
              <button className="btn btn-ghost hidden !py-2.5 sm:inline-flex" onClick={() => openAuth()}>
                <LogIn size={16} /> Connexion
              </button>
            </>
          )}

          <Link to="/distro" className="btn btn-primary !py-2.5" title="Ouvrir SXTNN DISTRO, le portail de distribution">
            <Mic size={16} />
            <span className="hidden sm:inline">Accès Artiste</span>
            <span className="sm:hidden">Artiste</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
