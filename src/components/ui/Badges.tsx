import { BadgeCheck, Lock } from 'lucide-react';

export function VerifiedBadge({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <span title="Artiste vérifié" className={`inline-flex shrink-0 text-accent ${className}`}>
      <BadgeCheck size={size} fill="currentColor" stroke="rgb(var(--bg))" strokeWidth={2} />
    </span>
  );
}

/** Petit [E] des morceaux explicites */
export function ExplicitMark({ className = '' }: { className?: string }) {
  return (
    <span
      title="Contenu explicite"
      className={`inline-grid h-4 w-4 shrink-0 place-items-center rounded-[3px] bg-muted/80 text-[10px] font-extrabold leading-none text-bg ${className}`}
    >
      E
    </span>
  );
}

export function LeakBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-extrabold uppercase leading-none tracking-wider text-white shadow-[0_0_14px_-2px_rgba(239,68,68,0.8)] ${className}`}
    >
      Leak
    </span>
  );
}

export function ExplicitBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wider text-white backdrop-blur ${className}`}
    >
      Explicite
    </span>
  );
}

/** Sortie réservée aux amis de l'artiste */
export function FriendsBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title="Visible uniquement par les amis de l'artiste"
      className={`inline-flex items-center gap-1 rounded-md bg-violet-500 px-1.5 py-0.5 text-[10px] font-extrabold uppercase leading-none tracking-wider text-white shadow-[0_0_14px_-2px_rgba(139,92,246,0.8)] ${className}`}
    >
      <Lock size={9} strokeWidth={3} /> Amis
    </span>
  );
}
