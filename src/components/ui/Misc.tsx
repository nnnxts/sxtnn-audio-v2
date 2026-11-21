import { useEffect, useRef, useState, type ReactNode } from 'react';
import { animate } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCount } from '../../lib/format';

/* ------------------------------ Equalizer ------------------------------ */

export function Equalizer({ playing = true, className = '' }: { playing?: boolean; className?: string }) {
  // 4 barres qui montent et descendent à des rythmes différents (style Spotify / Deezer)
  return (
    <span className={`eq inline-flex h-4 items-end gap-[2px] text-accent ${className}`} aria-hidden>
      {[1, 2, 3, 4].map((n) => (
        <span key={n} className={`eq-bar eq-b${n} ${playing ? 'eq-live' : ''}`} />
      ))}
    </span>
  );
}

/* ------------------------------ Skeleton ------------------------------ */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

export function CardGridSkeleton({ count = 8, round = false }: { count?: number; round?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-[var(--card-gap)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Skeleton className={`aspect-square w-full ${round ? '!rounded-full' : ''}`} />
          <Skeleton className="mt-3 h-3.5 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function RowsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

/* ------------------------------ Section header ------------------------------ */

export function SectionHeader({
  title,
  subtitle,
  action,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-4 flex items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------ Scroller (carrousel) ------------------------------ */

export function Scroller({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    // Marges négatives + rembourrage : la liste défile sans rogner le halo, l'anneau ni le survol des pastilles
    <div className={`group/scroller relative -mx-4 -mb-3 -mt-4 ${className}`}>
      <div
        ref={ref}
        onScroll={update}
        className="flex snap-x snap-proximity gap-[var(--card-gap)] overflow-x-auto px-4 pb-6 pt-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {canLeft && (
        <button
          onClick={() => scrollBy(-1)}
          aria-label="Précédent"
          className="glass absolute left-0 top-1/3 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-line opacity-0 shadow-soft transition-opacity group-hover/scroller:opacity-100 md:grid"
        >
          <ChevronLeft size={20} />
        </button>
      )}
      {canRight && (
        <button
          onClick={() => scrollBy(1)}
          aria-label="Suivant"
          className="glass absolute right-0 top-1/3 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-line opacity-0 shadow-soft transition-opacity group-hover/scroller:opacity-100 md:grid"
        >
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  );
}

/* ------------------------------ Nombre animé ------------------------------ */

export function AnimatedNumber({ value, className = '' }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const controls = animate(fromRef.current, value, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
      onComplete: () => {
        fromRef.current = value;
      },
    });
    return () => {
      fromRef.current = value;
      controls.stop();
    };
  }, [value]);

  return <span className={`tabular-nums ${className}`}>{formatCount(display)}</span>;
}

/* ------------------------------ États vides / erreurs ------------------------------ */

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line px-6 py-14 text-center">
      {icon && <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-card text-accent">{icon}</div>}
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {text && <p className="mt-1.5 max-w-md text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      title="Oups, un problème est survenu"
      text={message}
      action={
        onRetry ? (
          <button className="btn btn-ghost" onClick={onRetry}>
            Réessayer
          </button>
        ) : undefined
      }
    />
  );
}

/* ------------------------------ Interrupteur ------------------------------ */

export function Switch({
  checked,
  onChange,
  label,
  description,
  danger = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:bg-card"
    >
      <span>
        <span className={`block text-sm font-semibold ${danger && checked ? 'text-red-400' : ''}`}>{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? (danger ? 'bg-red-500' : 'bg-accent') : 'bg-hover'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  );
}
