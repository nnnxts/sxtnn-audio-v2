import { useEffect } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sidebar, MobileNav } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { PlayerBar } from './components/player/PlayerBar';
import { SidePanels } from './components/player/SidePanels';
import { MobilePlayer } from './components/player/MobilePlayer';
import { AuthModal } from './components/modals/AuthModal';
import { AppearanceModal } from './components/modals/AppearanceModal';
import { AddToPlaylistModal } from './components/modals/AddToPlaylistModal';
import { ThemeDecor } from './components/ThemeDecor';
import Home from './pages/Home';
import Explore from './pages/Explore';
import ArtistPage from './pages/ArtistPage';
import ReleasePage from './pages/ReleasePage';
import LikesPage from './pages/LikesPage';
import PlaylistsPage from './pages/PlaylistsPage';
import PlaylistPage from './pages/PlaylistPage';
import NotFound from './pages/NotFound';
import InvitePage from './pages/InvitePage';
import DistroLogin from './pages/distro/DistroLogin';
import DistroDashboard from './pages/distro/DistroDashboard';

/** Mise en page de SXTNN AUDIO : barre latérale, barre du haut, contenu. */
function Shell() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="md:pl-[var(--sidebar-w)]">
        <Topbar />
        <main
          className="px-4 pt-6 sm:px-6 md:px-[var(--page-pad)]"
          style={{ paddingBottom: 'calc(var(--player-h) + var(--mnav-h) + 2.5rem)' }}
        >
          <motion.div key={pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: 'easeOut' }}>
            <Outlet />
          </motion.div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

export default function App() {
  return (
    <>
      <div className="ambient" aria-hidden />
      <ThemeDecor />
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="explore" element={<Explore />} />
          <Route path="artist/:id" element={<ArtistPage />} />
          <Route path="release/:id" element={<ReleasePage />} />
          <Route path="likes" element={<LikesPage />} />
          <Route path="library" element={<PlaylistsPage />} />
          <Route path="playlist/:id" element={<PlaylistPage />} />
          <Route path="invite/:token" element={<InvitePage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="/distro" element={<DistroLogin />} />
        <Route path="/distro/dashboard" element={<DistroDashboard />} />
      </Routes>

      {/* Éléments globaux : le lecteur ne se démonte JAMAIS lors d'un changement de page */}
      <SidePanels />
      <PlayerBar />
      <MobilePlayer />
      <AuthModal />
      <AppearanceModal />
      <AddToPlaylistModal />
    </>
  );
}
