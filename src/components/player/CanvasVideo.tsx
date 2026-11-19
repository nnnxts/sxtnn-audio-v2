import { useEffect, useRef } from 'react';

/** Vidéo « canvas » en boucle, sans son. La boucle suit l'état de lecture du morceau. */
export function CanvasVideo({ src, playing, className = 'h-full w-full object-cover' }: { src: string; playing: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (playing) void video.play().catch(() => undefined);
    else video.pause();
  }, [playing, src]);

  return <video ref={ref} key={src} src={src} muted loop autoPlay playsInline preload="auto" className={className} />;
}
