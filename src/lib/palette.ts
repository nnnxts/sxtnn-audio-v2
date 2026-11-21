import type { CSSProperties } from 'react';
import { useDominantColor } from './color';

/* Petits calculs de couleur partagés par la couleur des boutons et l'adaptation aux pochettes. */

export type Channels = [number, number, number];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function hexToChannels(hex: string): Channels | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function channelsToHex([r, g, b]: Channels): string {
  return `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

export const toVar = (c: Channels) => `${Math.round(c[0])} ${Math.round(c[1])} ${Math.round(c[2])}`;

/** Luminance perçue 0..1 */
export function luminance([r, g, b]: Channels): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function mix(a: Channels, b: Channels, t: number): Channels {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgbToHsl([r, g, b]: Channels): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): Channels {
  const hh = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** Couleur de texte lisible (blanc ou presque noir) sur un fond donné. */
export function onColor(bg: Channels): Channels {
  return luminance(bg) > 0.42 ? [14, 12, 20] : [255, 255, 255];
}

/** Deuxième couleur du dégradé quand la personne n'en choisit qu'une : même teinte, décalée. */
export function companion(c: Channels): Channels {
  const [h, s, l] = rgbToHsl(c);
  return hslToRgb(h + 28, clamp(s, 0.45, 1), clamp(l + 0.06, 0.4, 0.72));
}

/**
 * Variables CSS pour des boutons « couleur personnalisée ».
 * accent2 absent -> teinte voisine ; accent2 === accent -> bouton uni.
 */
export function customVars(accentHex: string, accent2Hex: string | null): Record<string, string> | null {
  const a = hexToChannels(accentHex);
  if (!a) return null;
  const b = (accent2Hex && hexToChannels(accent2Hex)) || companion(a);
  const avg = mix(a, b, 0.5);
  return { '--c-accent': toVar(a), '--c-accent2': toVar(b), '--c-onaccent': toVar(onColor(avg)) };
}

/**
 * Style (variables CSS) qui adapte une zone à la pochette :
 * boutons en dégradé « couleur de la pochette → version claire », comme Pink Tape = rose → blanc rosé.
 */
export function coverStyle(rgb: string | null): CSSProperties | undefined {
  if (!rgb) return undefined;
  const parts = rgb.split(' ').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return undefined;
  const base = parts as Channels;
  // On garde une couleur vive et lisible : ni trop sombre, ni délavée
  const [h, s, l] = rgbToHsl(base);
  const main = hslToRgb(h, clamp(s * 1.1, 0.4, 1), clamp(l, 0.46, 0.66));
  const light = mix(main, [255, 255, 255], 0.62);
  const onAcc = onColor(mix(main, light, 0.5));
  return {
    '--accent': toVar(main),
    '--accent2': toVar(light),
    '--onaccent': toVar(onAcc),
  } as CSSProperties;
}

/** Hook : style adapté à la pochette (undefined si désactivé ou pochette absente). */
export function useCoverStyle(url: string | null | undefined, enabled: boolean): CSSProperties | undefined {
  const rgb = useDominantColor(enabled ? url : null);
  return enabled ? coverStyle(rgb) : undefined;
}
