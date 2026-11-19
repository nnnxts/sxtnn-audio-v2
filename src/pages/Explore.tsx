import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Compass, Disc3, Gem, Sparkles } from 'lucide-react';
import { useApi, useDocumentTitle } from '../lib/hooks';
import type { Release, Track } from '../lib/types';
import { hueFromText, plural } from '../lib/format';
import { CardGridSkeleton, EmptyState, ErrorState, RowsSkeleton, SectionHeader } from '../components/ui/Misc';
import { ReleaseGrid } from '../components/ReleaseCard';
import { TrackRow } from '../components/TrackRow';

interface ExploreData {
  genres: { genre: string; count: number }[];
  releases?: Release[];
  tracks?: Track[];
}

type Filter = 'all' | 'new' | 'gems' | `genre:${string}`;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        active ? 'text-onaccent' : 'bg-card text-muted hover:bg-hover hover:text-fg'
      }`}
    >
      {active && <motion.span layoutId="explore-chip" className="absolute inset-0 rounded-full bg-accent-gradient shadow-glow" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
      <span className="relative flex items-center gap-1.5">{children}</span>
    </button>
  );
}

export default function Explore() {
  useDocumentTitle('Explorer');
  const [filter, setFilter] = useState<Filter>('all');

  const path = useMemo(() => {
    if (filter === 'all') return '/explore?kind=all';
    if (filter === 'new') return '/explore?kind=new';
    if (filter === 'gems') return '/explore?kind=gems';
    return `/explore?kind=genre&genre=${encodeURIComponent(filter.slice(6))}`;
  }, [filter]);

  const { data, loading, error, reload } = useApi<ExploreData>(path);
  // On garde la liste des genres d'un chargement à l'autre (pas de clignotement des puces)
  const [genres, setGenres] = useState<ExploreData['genres']>([]);
  useEffect(() => {
    if (data?.genres?.length) setGenres(data.genres);
  }, [data]);

  const genreName = filter.startsWith('genre:') ? filter.slice(6) : null;

  return (
    <div className="space-y-[var(--section-gap)]">
      <header>
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Explorer</h1>
        <p className="mt-2 text-muted">Parcourez les genres, les nouveautés et les pépites cachées.</p>
      </header>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          <Compass size={15} /> Tout
        </Chip>
        <Chip active={filter === 'new'} onClick={() => setFilter('new')}>
          <Sparkles size={15} /> Nouveautés
        </Chip>
        <Chip active={filter === 'gems'} onClick={() => setFilter('gems')}>
          <Gem size={15} /> Pépites
        </Chip>
        {genres.map((g) => (
          <Chip key={g.genre} active={filter === `genre:${g.genre}`} onClick={() => setFilter(`genre:${g.genre}`)}>
            {g.genre}
          </Chip>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <motion.div key={filter} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-[var(--section-gap)]">
          {/* Tuiles de genres */}
          {filter === 'all' && genres.length > 0 && (
            <section>
              <SectionHeader title="Parcourir par genre" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {genres.map((g, i) => {
                  const hue = hueFromText(g.genre);
                  return (
                    <motion.button
                      key={g.genre}
                      onClick={() => setFilter(`genre:${g.genre}`)}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 12) * 0.03 }}
                      whileHover={{ y: -4, scale: 1.015 }}
                      whileTap={{ scale: 0.98 }}
                      className="relative h-28 overflow-hidden rounded-2xl p-4 text-left text-white shadow-soft"
                      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 44%), hsl(${(hue + 55) % 360} 75% 28%))` }}
                    >
                      <span className="relative font-display text-xl font-extrabold leading-tight">{g.genre}</span>
                      <span className="relative mt-0.5 block text-xs font-medium text-white/75">{plural(g.count, 'sortie', 'sorties')}</span>
                      <Disc3 size={78} strokeWidth={1.2} className="absolute -bottom-4 -right-3 rotate-12 text-white/20" />
                    </motion.button>
                  );
                })}
              </div>
            </section>
          )}

          {loading && !data && (
            <>
              <CardGridSkeleton count={8} />
              <RowsSkeleton count={4} />
            </>
          )}

          {data?.releases && data.releases.length > 0 && (
            <section>
              <SectionHeader
                title={filter === 'new' ? 'Toutes les nouveautés' : genreName ? `Sorties ${genreName}` : 'Nouveautés'}
                subtitle={filter === 'all' ? 'Les plus récentes, hors leaks' : undefined}
              />
              <ReleaseGrid releases={data.releases} />
            </section>
          )}

          {data?.tracks && data.tracks.length > 0 && (
            <section>
              <SectionHeader
                title={filter === 'gems' || filter === 'all' ? 'Pépites' : genreName ? `Titres ${genreName} les plus écoutés` : 'Titres'}
                subtitle={filter === 'gems' || filter === 'all' ? 'Peu écoutés, mais déjà aimés' : undefined}
              />
              <div className="grid gap-x-8 xl:grid-cols-2">
                {data.tracks.map((t, i) => (
                  <TrackRow key={t.id} track={t} tracks={data.tracks!} index={i} lead="plain" showCover />
                ))}
              </div>
            </section>
          )}

          {!loading && data && !(data.releases?.length || data.tracks?.length) && (
            <EmptyState icon={<Compass size={26} />} title="Rien à explorer ici pour l'instant" text="Aucun contenu ne correspond à ce filtre." />
          )}
        </motion.div>
      )}
    </div>
  );
}
