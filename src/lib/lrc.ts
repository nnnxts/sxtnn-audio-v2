/* ============================================================
 * Paroles synchronisées au format LRC : « [mm:ss.xx] texte »
 * Le même champ « paroles » sert pour le texte simple et pour le LRC :
 * un texte sans horodatage reste un texte simple.
 * ============================================================ */

export interface LrcLine {
  /** secondes depuis le début du morceau */
  t: number;
  text: string;
}

const TAG_RE = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

export interface ParsedLyrics {
  synced: boolean;
  lines: LrcLine[];
  /** texte brut si non synchronisé */
  plain: string;
}

export function parseLyrics(raw: string): ParsedLyrics {
  const text = (raw || '').replace(/\r\n?/g, '\n');
  const lines: LrcLine[] = [];
  let offset = 0; // décalage global en secondes ([offset:+500] = 500 ms)

  for (const row of text.split('\n')) {
    const off = /^\[offset:\s*([+-]?\d+)\]/i.exec(row.trim());
    if (off) {
      offset = Number(off[1]) / 1000;
      continue;
    }
    const stamps: number[] = [];
    TAG_RE.lastIndex = 0;
    let lastEnd = 0;
    let m: RegExpExecArray | null;
    while ((m = TAG_RE.exec(row)) !== null) {
      if (m.index !== lastEnd && stamps.length === 0 && row.slice(0, m.index).trim() !== '') break;
      const frac = m[3] ? Number(`0.${m[3]}`) : 0;
      stamps.push(Number(m[1]) * 60 + Number(m[2]) + frac);
      lastEnd = TAG_RE.lastIndex;
    }
    if (!stamps.length) continue;
    const content = row.slice(lastEnd).trim();
    for (const s of stamps) lines.push({ t: Math.max(0, s + offset), text: content });
  }

  if (lines.length >= 2) {
    lines.sort((a, b) => a.t - b.t);
    return { synced: true, lines, plain: lines.map((l) => l.text).join('\n') };
  }
  // Texte simple (on retire d'éventuelles balises isolées pour ne pas les afficher)
  return { synced: false, lines: [], plain: text.replace(TAG_RE, '').trim() };
}

export function formatStamp(t: number): string {
  const safe = Math.max(0, t);
  const mm = Math.floor(safe / 60);
  const ss = safe - mm * 60;
  return `${String(mm).padStart(2, '0')}:${ss.toFixed(2).padStart(5, '0')}`;
}

export function buildLrc(lines: { t: number; text: string }[]): string {
  return lines
    .slice()
    .sort((a, b) => a.t - b.t)
    .map((l) => `[${formatStamp(l.t)}]${l.text}`)
    .join('\n');
}

/** Indice de la ligne en cours à l'instant `time` (-1 avant la première). Recherche dichotomique. */
export function activeLineIndex(lines: LrcLine[], time: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= time) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}
