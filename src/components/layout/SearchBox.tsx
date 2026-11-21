import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Play, Search, X } from 'lucide-react';
import { api } from '../../lib/api';
import type { SearchResults, Track } from '../../lib/types';
import { releaseSubtitle, releaseYear, trackSubtitle, typeLabel } from '../../lib/format';
import { useDebounced } from '../../lib/hooks';
import { usePlayer } from '../../context/PlayerContext';
import { Avatar, Cover } from '../ui/Cover';
import { ExplicitMark, FriendsBadge, LeakBadge, VerifiedBadge } from '../ui/Badges';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-2 pb-2">
      <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-muted">{title}</p>
      {children}
    </div>
  );
}

/** Recherche globale instantanée : meilleur résultat, titres, artistes, albums/EPs. */
export function SearchBox() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const debounced = useDebounced(query.trim(), 180);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { playTracks } = usePlayer();

  // Ferme à chaque changement de page
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Recherche
  useEffect(() => {
    if (!debounced) {
      setResults(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    api
      .get<SearchResults>(`/search?q=${encodeURIComponent(debounced)}`, controller.signal)
      .then((res) => {
        setResults(res);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setLoading(false);
      });
    return () => controller.abort();
  }, [debounced]);

  // Clic extérieur + raccourcis ("/" ou Ctrl+K pour focus, Échap pour fermer)
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.matches?.('input, textarea, select, [contenteditable="true"]');
      if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const close = () => {
    setOpen(false);
    inputRef.current?.blur();
  };

  const playOne = (track: Track, list: Track[]) => {
    const idx = list.findIndex((t) => t.id === track.id);
    playTracks(list, Math.max(0, idx));
    close();
  };

  const go = (path: string) => {
    navigate(path);
    close();
  };

  const empty = !!results && !results.best && !results.tracks.length && !results.artists.length && !results.releases.length;
  const showPanel = open && query.trim().length > 0;

  return (
    <div ref={wrapRef} className="relative w-full max-w-xl">
      <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Artistes, titres, albums…"
        aria-label="Recherche"
        className="w-full rounded-full border border-line bg-card py-2.5 pl-11 pr-20 text-sm outline-none transition-all placeholder:text-muted/70 focus:border-accent focus:bg-surface focus:shadow-[0_0_0_3px_rgb(var(--accent)/0.2)]"
      />
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
        {loading && <Loader2 size={16} className="animate-spin text-muted" />}
        {query ? (
          <button className="icon-btn h-6 w-6" onClick={() => setQuery('')} aria-label="Effacer">
            <X size={15} />
          </button>
        ) : (
          <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold text-muted sm:block">/</kbd>
        )}
      </div>

      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="glass absolute left-0 right-0 top-[calc(100%+10px)] z-50 max-h-[65dvh] overflow-y-auto rounded-3xl border border-line shadow-soft sm:min-w-[520px]"
          >
            {!results && loading && <p className="px-6 py-8 text-center text-sm text-muted">Recherche en cours…</p>}
            {empty && (
              <div className="px-6 py-10 text-center">
                <p className="font-display text-lg font-bold">Aucun résultat pour « {debounced} »</p>
                <p className="mt-1 text-sm text-muted">Vérifiez l'orthographe ou essayez un autre nom.</p>
              </div>
            )}

            {results && !empty && (
              <>
                {results.best && (
                  <Section title="Meilleur résultat">
                    {results.best.type === 'artist' && (
                      <button
                        onClick={() => go(`/artist/${results.best!.item.id}`)}
                        className="flex w-full items-center gap-4 rounded-2xl bg-card px-4 py-3 text-left transition-colors hover:bg-hover"
                      >
                        <Avatar src={(results.best.item as { avatar_url: string | null }).avatar_url} name={results.best.item.name} className="h-16 w-16" />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 font-display text-xl font-bold">
                            <span className="truncate">{results.best.item.name}</span>
                            {results.best.item.is_verified && <VerifiedBadge />}
                          </span>
                          <span className="text-sm text-muted">Artiste</span>
                        </span>
                      </button>
                    )}
                    {results.best.type === 'track' && (
                      <button
                        onClick={() => playOne(results.best!.item as Track, [results.best!.item as Track])}
                        className="group flex w-full items-center gap-4 rounded-2xl bg-card px-4 py-3 text-left transition-colors hover:bg-hover"
                      >
                        <div className="relative">
                          <Cover src={(results.best.item as Track).cover_url} alt={(results.best.item as Track).release_title} className="h-16 w-16" />
                          <span className="absolute inset-0 grid place-items-center rounded-cover bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
                            <Play size={22} fill="currentColor" />
                          </span>
                        </div>
                        <span className="min-w-0">
                          <span className="block truncate font-display text-xl font-bold">{(results.best.item as Track).title}</span>
                          <span className="block truncate text-sm text-muted">Titre · {trackSubtitle(results.best.item as Track)}</span>
                        </span>
                      </button>
                    )}
                    {results.best.type === 'release' && (
                      <button
                        onClick={() => go(`/release/${results.best!.item.id}`)}
                        className="flex w-full items-center gap-4 rounded-2xl bg-card px-4 py-3 text-left transition-colors hover:bg-hover"
                      >
                        <Cover src={(results.best.item as { cover_url: string | null }).cover_url} alt={(results.best.item as { title: string }).title} className="h-16 w-16" />
                        <span className="min-w-0">
                          <span className="block truncate font-display text-xl font-bold">{(results.best.item as { title: string }).title}</span>
                          <span className="block truncate text-sm text-muted">
                            {typeLabel((results.best.item as { type: 'single' | 'ep' | 'album' }).type)} · {releaseSubtitle(results.best.item as never)}
                          </span>
                        </span>
                      </button>
                    )}
                  </Section>
                )}

                {results.tracks.length > 0 && (
                  <Section title="Titres">
                    {results.tracks.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => playOne(t, results.tracks)}
                        className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-card"
                      >
                        <div className="relative">
                          <Cover src={t.cover_url} alt={t.release_title} className="h-10 w-10" flat />
                          <span className="absolute inset-0 grid place-items-center rounded-cover bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100">
                            <Play size={16} fill="currentColor" />
                          </span>
                        </div>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold">{t.title}</span>
                            {t.is_explicit && <ExplicitMark />}
                            {t.is_leak && <LeakBadge />}
                            {t.visibility === 'friends' && <FriendsBadge />}
                          </span>
                          <span className="block truncate text-xs text-muted">{trackSubtitle(t)}</span>
                        </span>
                      </button>
                    ))}
                  </Section>
                )}

                {results.artists.length > 0 && (
                  <Section title="Artistes">
                    {results.artists.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => go(`/artist/${a.id}`)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-card"
                      >
                        <Avatar src={a.avatar_url} name={a.name} className="h-10 w-10" />
                        <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                          <span className="truncate">{a.name}</span>
                          {a.is_verified && <VerifiedBadge size={14} />}
                        </span>
                      </button>
                    ))}
                  </Section>
                )}

                {results.releases.length > 0 && (
                  <Section title="Albums / EPs">
                    {results.releases.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => go(`/release/${r.id}`)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-card"
                      >
                        <Cover src={r.cover_url} alt={r.title} className="h-10 w-10" flat />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold">{r.title}</span>
                            {r.is_leak && <LeakBadge />}
                            {r.visibility === 'friends' && <FriendsBadge />}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {typeLabel(r.type)} · {releaseYear(r.release_date)} · {releaseSubtitle(r)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </Section>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
