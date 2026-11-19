import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Disc3, Music, Pause, Play, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { useApi, useDocumentTitle } from '../lib/hooks';
import type { Artist, HomeData, Release, Track } from '../lib/types';
import { formatReleaseDate, formatTotalDuration, typeLabel } from '../lib/format';
import { useDominantColor } from '../lib/color';
import { usePlayRelease } from '../lib/usePlayRelease';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { Cover } from '../components/ui/Cover';
import { VerifiedBadge } from '../components/ui/Badges';
import { CardGridSkeleton, EmptyState, ErrorState, RowsSkeleton, Scroller, SectionHeader, Skeleton } from '../components/ui/Misc';
import { TrackRow } from '../components/TrackRow';
import { ArtistCard } from '../components/ArtistCard';
import { ReleaseCard, ReleaseGrid } from '../components/ReleaseCard';

/* ------------------------------ Sortie à la une ------------------------------ */

function FeaturedHero({ release }: { release: Release }) {
  const color = useDominantColor(release.cover_url);
  const playRelease = usePlayRelease();
  const { currentTrack, isPlaying, togglePlay } = usePlayer();
  const isCurrent = currentTrack?.release_id === release.id;
  const playing = isCurrent && isPlaying;

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } } };

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative isolate overflow-hidden rounded-[28px] border border-line/60 shadow-soft"
    >
      {/* Fond flouté extrait de la pochette */}
      {release.cover_url && (
        <img
          src={release.cover_url}
          alt=""
          aria-hidden
          className="absolute inset-0 -z-20 h-full w-full scale-150 object-cover opacity-70 blur-[60px] saturate-150"
        />
      )}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: `linear-gradient(115deg, rgb(${color ?? 'var(--accent)'} / 0.55) 0%, rgb(var(--bg) / 0.55) 55%, rgb(var(--bg) / 0.92) 100%)`,
        }}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-bg/70 via-transparent to-transparent" />

      <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-end sm:gap-9 sm:p-10">
        <motion.div variants={item} className="relative shrink-0">
          <div className="absolute inset-4 -z-10 rounded-full opacity-70 blur-3xl" style={{ background: `rgb(${color ?? 'var(--accent)'})` }} />
          <Link to={`/release/${release.id}`}>
            <Cover src={release.cover_url} alt={release.title} className="h-52 w-52 sm:h-60 sm:w-60 lg:h-64 lg:w-64 !shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)]" />
          </Link>
        </motion.div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <motion.span variants={item} className="inline-flex items-center gap-1.5 rounded-full bg-accent-gradient px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-onaccent shadow-glow">
            <Sparkles size={12} /> Sortie à la une
          </motion.span>
          <motion.h1 variants={item} className="mt-4 font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
            {release.title}
          </motion.h1>
          <motion.p variants={item} className="mt-3 text-base text-fg/85 sm:text-lg">
            Par{' '}
            {release.artists.map((a, i) => (
              <span key={a.id}>
                {i > 0 && ', '}
                <Link to={`/artist/${a.id}`} className="inline-flex items-center gap-1 font-semibold hover:underline">
                  {a.name}
                  {a.is_verified && <VerifiedBadge size={15} />}
                </Link>
              </span>
            ))}
          </motion.p>
          <motion.p variants={item} className="mt-1.5 text-sm text-fg/60">
            {typeLabel(release.type)} · {formatReleaseDate(release.release_date)} · {release.track_count} titre{release.track_count > 1 ? 's' : ''}
            {release.total_duration > 0 && ` · ${formatTotalDuration(release.total_duration)}`}
          </motion.p>
          <motion.div variants={item} className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
            <button className="btn btn-primary !px-6 !py-3.5" onClick={() => (isCurrent ? togglePlay() : playRelease(release.id))}>
              {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              {playing ? 'Pause' : 'Écouter'}
            </button>
            <Link to={`/release/${release.id}`} className="btn btn-ghost !bg-white/10 !px-6 !py-3.5 backdrop-blur hover:!bg-white/20">
              <Disc3 size={18} /> Découvrir l'album
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </motion.section>
  );
}

function HeroSkeleton() {
  return <Skeleton className="h-[360px] w-full !rounded-[28px] sm:h-[400px]" />;
}

/* ------------------------------ Recommandations ------------------------------ */

interface Recos {
  ready: boolean;
  genres: string[];
  releases: Release[];
  artists: Artist[];
}

function Recommendations() {
  const { user } = useAuth();
  const { data, loading } = useApi<Recos>(user ? '/me/recommendations' : null, [user?.id]);

  if (!user) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-line bg-card/60 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-accent/25 blur-3xl" />
        <div className="relative flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-xl font-bold">Des recommandations rien que pour vous</h2>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Créez un compte gratuit : coups de cœur, playlists, artistes suivis et suggestions basées sur ce que vous écoutez.
            </p>
          </div>
          <AuthButton />
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section>
        <SectionHeader title="Recommandé pour vous" />
        <CardGridSkeleton count={6} />
      </section>
    );
  }

  if (!data || !data.ready) {
    return (
      <section className="rounded-3xl border border-dashed border-line p-6 text-center">
        <Sparkles className="mx-auto mb-2 text-accent" size={22} />
        <h2 className="font-display text-lg font-bold">Vos recommandations arrivent</h2>
        <p className="mt-1 text-sm text-muted">Écoutez quelques titres ou ajoutez des coups de cœur : nous adapterons cette section à vos goûts.</p>
      </section>
    );
  }

  return (
    <>
      <section>
        <SectionHeader
          title="Recommandé pour vous"
          subtitle={data.genres.length ? `D'après vos écoutes : ${data.genres.join(', ')}` : undefined}
        />
        {data.releases.length === 0 ? (
          <p className="text-sm text-muted">Rien de nouveau à vous proposer pour le moment.</p>
        ) : (
          <Scroller>
            {data.releases.map((r, i) => (
              <ReleaseCard key={r.id} release={r} index={i} className="w-[148px] shrink-0 snap-start sm:w-[170px]" />
            ))}
          </Scroller>
        )}
      </section>
      {data.artists.length > 0 && (
        <section>
          <SectionHeader title="Artistes à découvrir" subtitle="Dans vos genres préférés" />
          <Scroller>
            {data.artists.map((a, i) => (
              <ArtistCard key={a.id} artist={a} index={i} />
            ))}
          </Scroller>
        </section>
      )}
    </>
  );
}

function AuthButton() {
  const { openAuth } = useAuth();
  return (
    <button className="btn btn-primary shrink-0" onClick={() => openAuth()}>
      Créer un compte
    </button>
  );
}

/* ------------------------------ Page ------------------------------ */

export default function Home() {
  useDocumentTitle('Accueil');
  const { data, loading, error, reload, setData } = useApi<HomeData>('/home');

  // Classement "en direct" : on rafraîchit les écoutes toutes les 15 secondes
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      api
        .get<{ tracks: Track[] }>('/top-tracks?limit=10')
        .then((res) => setData((prev) => (prev ? { ...prev, topTracks: res.tracks } : prev)))
        .catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(id);
  }, [setData]);

  if (error) return <ErrorState message={error} onRetry={reload} />;

  const empty = !loading && data && data.latest.length === 0 && data.artists.length === 0;

  return (
    <div className="space-y-[var(--section-gap)]">
      {loading || !data ? (
        <HeroSkeleton />
      ) : data.featured ? (
        <FeaturedHero release={data.featured} />
      ) : null}

      {empty && (
        <EmptyState
          icon={<Music size={26} />}
          title="Le catalogue est encore vide"
          text="Aucune sortie n'a été publiée pour le moment. Ouvrez l'Accès Artiste pour publier votre première musique."
          action={
            <Link to="/distro" className="btn btn-primary">
              Accès Artiste
            </Link>
          }
        />
      )}

      {/* Titres les plus écoutés */}
      {(loading || (data && data.topTracks.some((t) => t.play_count > 0))) && (
        <section>
          <SectionHeader
            title="Titres les plus écoutés"
            action={
              <span className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-muted">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                En direct
              </span>
            }
          />
          {loading || !data ? (
            <RowsSkeleton count={5} />
          ) : (
            <div className="grid gap-x-8 xl:grid-cols-2">
              {data.topTracks
                .filter((t) => t.play_count > 0)
                .map((t, i, list) => (
                  <TrackRow key={t.id} track={t} tracks={list} index={i} lead="rank" showCover />
                ))}
            </div>
          )}
        </section>
      )}

      <Recommendations />

      {/* Artistes disponibles */}
      {(loading || (data && data.artists.length > 0)) && (
        <section>
          <SectionHeader title="Artistes disponibles" subtitle={data ? `${data.artists.length} artiste${data.artists.length > 1 ? 's' : ''} sur la plateforme` : undefined} />
          {loading || !data ? (
            <CardGridSkeleton count={8} round />
          ) : (
            <Scroller>
              {data.artists.map((a, i) => (
                <ArtistCard key={a.id} artist={a} index={i} />
              ))}
            </Scroller>
          )}
        </section>
      )}

      {/* Dernières sorties */}
      {(loading || (data && data.latest.length > 0)) && (
        <section>
          <SectionHeader title="Dernières sorties" subtitle="Les nouveautés fraîchement publiées" />
          {loading || !data ? <CardGridSkeleton count={16} /> : <ReleaseGrid releases={data.latest} />}
        </section>
      )}
    </div>
  );
}
