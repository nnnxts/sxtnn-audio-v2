import { useEffect, useState } from 'react';
import { Music2 } from 'lucide-react';
import { hueFromText, initials } from '../../lib/format';

interface CoverProps {
  src?: string | null;
  alt: string;
  className?: string;
  /** true = pas d'ombre (miniatures dans les listes) */
  flat?: boolean;
}

/** Pochette carrée ; le style (arrondi / carré vinyle) vient du réglage "Apparence". */
export function Cover({ src, alt, className = '', flat = false }: CoverProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const hue = hueFromText(alt || 'x');

  return (
    <div
      className={`relative aspect-square shrink-0 overflow-hidden rounded-cover bg-card ${flat ? '' : 'cover-shadow'} ${className}`}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="grid h-full w-full place-items-center text-white/80"
          style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 38%), hsl(${(hue + 50) % 360} 65% 20%))` }}
        >
          <Music2 size={28} strokeWidth={1.6} />
        </div>
      )}
    </div>
  );
}

interface AvatarProps {
  src?: string | null;
  name: string;
  className?: string;
}

/** Avatar rond avec initiales si pas d'image. La taille se règle via className (ex: "h-12 w-12"). */
export function Avatar({ src, name, className = 'h-12 w-12' }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const hue = hueFromText(name || 'x');

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full bg-card ${className}`}>
      {src && !failed ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="grid h-full w-full place-items-center text-sm font-bold text-white"
          style={{ background: `linear-gradient(135deg, hsl(${hue} 60% 42%), hsl(${(hue + 60) % 360} 65% 28%))` }}
        >
          {initials(name)}
        </div>
      )}
    </div>
  );
}

/** Mosaïque des 4 premières pochettes d'une playlist (ou pochette personnalisée). */
export function PlaylistCover({
  cover,
  mosaic,
  title,
  className = '',
}: {
  cover: string | null;
  mosaic: string[];
  title: string;
  className?: string;
}) {
  if (cover) return <Cover src={cover} alt={title} className={className} />;
  if (mosaic.length === 0) return <Cover src={null} alt={title} className={className} />;
  if (mosaic.length < 4) return <Cover src={mosaic[0]} alt={title} className={className} />;
  return (
    <div className={`relative aspect-square shrink-0 overflow-hidden rounded-cover cover-shadow bg-card ${className}`}>
      <div className="grid h-full w-full grid-cols-2 grid-rows-2">
        {mosaic.slice(0, 4).map((url, i) => (
          <img key={i} src={url} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
        ))}
      </div>
    </div>
  );
}
