import { useEffect, useState } from 'react';

type RGB = [number, number, number];

const cache = new Map<string, RGB>();
const pending = new Map<string, Promise<RGB>>();

const FALLBACK: RGB = [139, 43, 255];

/** Extrait une couleur dominante "vive" d'une image (échantillonnage sur un canvas 32x32). */
export function getDominantColor(url: string): Promise<RGB> {
  const cached = cache.get(url);
  if (cached) return Promise.resolve(cached);
  const inFlight = pending.get(url);
  if (inFlight) return inFlight;

  const promise = new Promise<RGB>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(FALLBACK);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let r = 0;
        let g = 0;
        let b = 0;
        let weightSum = 0;
        for (let i = 0; i < data.length; i += 4) {
          const pr = data[i];
          const pg = data[i + 1];
          const pb = data[i + 2];
          const max = Math.max(pr, pg, pb);
          const min = Math.min(pr, pg, pb);
          const sat = max === 0 ? 0 : (max - min) / max;
          const lum = (max + min) / 510;
          // On favorise les pixels saturés et ni trop sombres ni trop clairs
          const weight = 0.05 + sat * sat * (1 - Math.abs(lum - 0.5) * 1.4);
          r += pr * weight;
          g += pg * weight;
          b += pb * weight;
          weightSum += weight;
        }
        if (weightSum <= 0) return resolve(FALLBACK);
        const out: RGB = [Math.round(r / weightSum), Math.round(g / weightSum), Math.round(b / weightSum)];
        cache.set(url, out);
        resolve(out);
      } catch {
        resolve(FALLBACK);
      }
    };
    img.onerror = () => resolve(FALLBACK);
    img.src = url;
  }).finally(() => pending.delete(url));

  pending.set(url, promise);
  return promise;
}

/** Hook : retourne "r g b" (canaux RGB) de la couleur dominante de la pochette, ou null. */
export function useDominantColor(url: string | null | undefined): string | null {
  const [color, setColor] = useState<string | null>(() => {
    const c = url ? cache.get(url) : undefined;
    return c ? c.join(' ') : null;
  });

  useEffect(() => {
    let alive = true;
    if (!url) {
      setColor(null);
      return;
    }
    getDominantColor(url).then((c) => {
      if (alive) setColor(c.join(' '));
    });
    return () => {
      alive = false;
    };
  }, [url]);

  return color;
}
