/**
 * Générateurs des décors de fond (formes SVG calculées une seule fois, à la demande).
 * Aucune dépendance : tout est du texte SVG, donc rien à télécharger et rien de lourd.
 */

/** Générateur pseudo-aléatoire déterministe : le décor est identique à chaque chargement. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache: Record<string, unknown> = {};
export function once<T>(key: string, make: () => T): T {
  if (!(key in cache)) cache[key] = make();
  return cache[key] as T;
}

const f = (n: number) => n.toFixed(1);

/** Tache d'encre façon vecteur années 2000 : un blob à pointes + des gouttelettes. */
export function splat(): { d: string; dots: { x: number; y: number; r: number }[] } {
  return once('splat', () => {
    const r = rng(11);
    const N = 54;
    const P: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      let rad = 105 + r() * 55;
      if (i % 3 === 0) rad *= 1.45 + r() * 1.05;
      P.push([400 + Math.cos(a) * rad, 400 + Math.sin(a) * rad]);
    }
    const mid = (p: [number, number], q: [number, number]): [number, number] => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    let d = `M${f(mid(P[0], P[1])[0])} ${f(mid(P[0], P[1])[1])}`;
    for (let i = 1; i <= N; i++) {
      const p = P[i % N];
      const m = mid(p, P[(i + 1) % N]);
      d += `Q${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])}`;
    }
    d += 'Z';
    const dots: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < 42; i++) {
      const a = r() * Math.PI * 2;
      const dist = 200 + r() * 185;
      dots.push({ x: 400 + Math.cos(a) * dist, y: 400 + Math.sin(a) * dist, r: Math.max(2, 15 - dist / 32 + r() * 5) });
    }
    return { d, dots };
  });
}

/** Horizon de ville : immeubles + fenêtres allumées, en deux tracés seulement. */
export function city(): { buildings: string; windows: string } {
  return once('city', () => {
    const r = rng(23);
    let b = '';
    let w = '';
    let x = 0;
    while (x < 1200) {
      const bw = 26 + r() * 54;
      const bh = 40 + r() * 140 * (0.45 + 0.55 * Math.sin((x / 1200) * Math.PI));
      b += `M${f(x)} 200V${f(200 - bh)}H${f(x + bw)}V200Z`;
      const rows = Math.floor(bh / 18);
      for (let k = 0; k < rows; k++) {
        if (r() < 0.42) w += `M${f(x + 5 + r() * (bw - 14))} ${f(200 - bh + 8 + k * 18)}h4v6h-4z`;
      }
      x += bw + r() * 6;
    }
    return { buildings: b, windows: w };
  });
}

/** Brins d'herbe pour Frutiger Aero (deux couches : fond flou, avant net). */
export function grass(layer: 'back' | 'front'): string {
  return once(`grass-${layer}`, () => {
    const r = rng(layer === 'back' ? 5 : 9);
    const hMin = layer === 'back' ? 70 : 38;
    const hMax = layer === 'back' ? 150 : 108;
    let d = '';
    let x = -10;
    while (x < 1610) {
      const h = hMin + r() * (hMax - hMin);
      const bend = (r() - 0.5) * 46;
      const w = 7 + r() * 5;
      d += `M${f(x)} 200Q${f(x + bend * 0.3)} ${f(200 - h * 0.6)} ${f(x + bend)} ${f(200 - h)}Q${f(x + bend * 0.3 + w)} ${f(200 - h * 0.55)} ${f(x + w)} 200Z`;
      x += 7 + r() * 9;
    }
    return d;
  });
}

/** Étoile à 5 branches (centre 50,50 dans un carré 100×100). */
export const STAR_POINTS = '50,4 61.8,36.9 96.8,38.2 69.2,59.8 78.8,93.3 50,73.6 21.2,93.3 30.8,59.8 3.2,38.2 38.2,36.9';

/** Bulles (Frutiger Aero) : taille en px, position horizontale en %, durée, décalage, dérive latérale en px. */
export const AERO_BUBBLES: { s: number; x: number; dur: number; delay: number; dx: number }[] = [
  { s: 64, x: 6, dur: 34, delay: -6, dx: 40 },
  { s: 28, x: 14, dur: 22, delay: -15, dx: -24 },
  { s: 108, x: 23, dur: 46, delay: -30, dx: 30 },
  { s: 38, x: 33, dur: 27, delay: -9, dx: -30 },
  { s: 76, x: 44, dur: 39, delay: -21, dx: 26 },
  { s: 22, x: 52, dur: 19, delay: -4, dx: 18 },
  { s: 54, x: 61, dur: 31, delay: -26, dx: -36 },
  { s: 120, x: 70, dur: 50, delay: -12, dx: -26 },
  { s: 32, x: 79, dur: 24, delay: -18, dx: 28 },
  { s: 70, x: 87, dur: 36, delay: -2, dx: -34 },
  { s: 24, x: 93, dur: 21, delay: -11, dx: 16 },
  { s: 46, x: 38, dur: 29, delay: -33, dx: 22 },
];

/** Étincelles (Metro, visibles seulement pendant la lecture) : position %, taille px, durée, décalage, teinte. */
export const METRO_SPARKS: { x: number; y: number; s: number; dur: number; delay: number; c: 'w' | 'p' | 'l' | 'v' }[] = [
  { x: 8, y: 22, s: 12, dur: 4.6, delay: -0.4, c: 'w' },
  { x: 17, y: 64, s: 8, dur: 5.4, delay: -2.1, c: 'p' },
  { x: 26, y: 38, s: 14, dur: 6.2, delay: -3.6, c: 'l' },
  { x: 34, y: 80, s: 9, dur: 4.2, delay: -1.2, c: 'w' },
  { x: 43, y: 18, s: 11, dur: 5.8, delay: -4.4, c: 'v' },
  { x: 49, y: 56, s: 7, dur: 4.9, delay: -0.9, c: 'p' },
  { x: 57, y: 30, s: 13, dur: 6.6, delay: -2.8, c: 'w' },
  { x: 64, y: 72, s: 9, dur: 5.1, delay: -3.3, c: 'l' },
  { x: 71, y: 14, s: 10, dur: 4.4, delay: -1.7, c: 'p' },
  { x: 77, y: 48, s: 15, dur: 6.9, delay: -5.2, c: 'w' },
  { x: 84, y: 84, s: 8, dur: 5.6, delay: -2.4, c: 'v' },
  { x: 90, y: 26, s: 12, dur: 4.8, delay: -0.2, c: 'l' },
  { x: 94, y: 62, s: 9, dur: 6.0, delay: -3.9, c: 'p' },
  { x: 3, y: 88, s: 10, dur: 5.3, delay: -4.8, c: 'w' },
  { x: 39, y: 8, s: 7, dur: 4.1, delay: -2.6, c: 'v' },
  { x: 60, y: 92, s: 11, dur: 6.4, delay: -1.5, c: 'l' },
];
