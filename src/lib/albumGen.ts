/**
 * Décors des thèmes « albums » et de quelques thèmes rétro.
 * Chaque décor est un simple texte HTML/SVG calculé une seule fois (formes tirées d'un générateur fixe),
 * donc rien à télécharger, aucune dépendance, et le même résultat à chaque chargement.
 * Les formes sont originales : elles reprennent les couleurs et l'ambiance de chaque pochette, pas ses dessins.
 */
import { once, rng } from './decorGen';

export type AlbumDecorId =
  | 'pinktape' | 'wlr' | 'fancy' | 'tlop' | 'grad' | 'astro' | 'chaos'
  | 'winamp' | 'imac';

const f = (n: number) => n.toFixed(1);
const pick = <T,>(r: () => number, list: T[]): T => list[Math.floor(r() * list.length) % list.length];

/* ------------------------------ Pink Tape : drapeau qui ondule ------------------------------ */
function pinktape(): string {
  return (
    '<div class="pt-flag"><i class="pt-stripes"></i>' +
    '<i class="pt-canton"><i class="pt-st"></i><i class="pt-st pt-st2"></i></i>' +
    '<i class="pt-wave"></i></div>'
  );
}

/* ------------------------------ Whole Lotta Red : rouge qui coule ------------------------------ */
function wlr(): string {
  const r = rng(31);
  let h = '<i class="wl-glow"></i><i class="wl-top"></i>';
  const N = 14;
  for (let i = 0; i < N; i++) {
    const x = ((i + 0.15 + r() * 0.7) / N) * 100;
    const w = 8 + r() * 20;
    const hh = 10 + r() * 32;
    h += `<i class="wl-drip" style="left:${f(x)}%;width:${f(w)}px;height:${f(hh)}vh;animation-duration:${f(5 + r() * 7)}s;animation-delay:-${f(r() * 10)}s"></i>`;
  }
  return h + '<i class="wl-grain"></i>';
}

/* ------------------------------ Fancy That : pétales, couronne, étincelles ------------------------------ */
function fancy(): string {
  const r = rng(53);
  let h = '<i class="fc-vignette"></i><i class="fc-strip fc-s1"></i><i class="fc-strip fc-s2"></i><i class="fc-strip fc-s3"></i>';
  for (let i = 0; i < 18; i++) {
    const s = 14 + r() * 20;
    h += `<i class="fc-petal fc-p-${pick(r, ['p', 'c', 'w'])}" style="left:${f(r() * 100)}%;width:${f(s)}px;height:${f(s * 1.15)}px;animation-duration:${f(12 + r() * 12)}s;animation-delay:-${f(r() * 22)}s;--dx:${f((r() - 0.5) * 180)}px"></i>`;
  }
  const spk: [number, number, number][] = [[12, 18, 26], [30, 70, 18], [48, 12, 22], [62, 54, 16], [78, 24, 28], [88, 78, 20], [94, 40, 16], [6, 62, 20]];
  spk.forEach(([x, y, s], i) => {
    h += `<i class="fc-spark" style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;animation-delay:-${f(i * 0.7)}s"></i>`;
  });
  h +=
    '<svg class="fc-crown" viewBox="0 0 120 100"><defs><linearGradient id="fc-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a0"/><stop offset=".55" stop-color="#e8aa30"/><stop offset="1" stop-color="#a86a10"/></linearGradient></defs>' +
    '<path d="M10 82L16 28L42 56L60 12L78 56L104 28L110 82Z" fill="url(#fc-gold)" stroke="#6b3a06" stroke-width="3" stroke-linejoin="round"/>' +
    '<rect x="10" y="82" width="100" height="12" rx="3" fill="url(#fc-gold)" stroke="#6b3a06" stroke-width="3"/>' +
    '<circle cx="16" cy="26" r="6" fill="#d62030"/><circle cx="60" cy="10" r="7" fill="#d62030"/><circle cx="104" cy="26" r="6" fill="#d62030"/>' +
    '<circle cx="36" cy="88" r="3" fill="#fff6d0"/><circle cx="60" cy="88" r="3" fill="#fff6d0"/><circle cx="84" cy="88" r="3" fill="#fff6d0"/></svg>';
  return h;
}

/* ------------------------------ The Life of Pablo : lignes de texte qui défilent ------------------------------ */
function tlop(): string {
  const lines = ['SXTNN AUDIO ', 'ÉCOUTE ENCORE ', 'SXTNN AUDIO ', 'NO PEACE ', 'ÉCOUTE ENCORE ', 'SXTNN AUDIO ', 'NO PEACE '];
  const dur = [62, 48, 70, 54, 66, 44, 58];
  let h = '';
  lines.forEach((t, i) => {
    const half = t.repeat(5);
    h += `<div class="tl-row${i % 2 ? ' tl-rev' : ''}" style="top:${f(2 + i * 14.2)}vh;animation-duration:${dur[i]}s"><span>${half}</span><span>${half}</span></div>`;
  });
  return h;
}

/* ------------------------------ Graduation : nuages, anneaux, toques ------------------------------ */
function grad(): string {
  const r = rng(61);
  let h =
    '<svg width="0" height="0"><symbol id="gr-cap" viewBox="0 0 100 80"><path d="M24 38v18c0 9 52 9 52 0V38L50 50Z" fill="#2a1450" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>' +
    '<path d="M50 6L96 26L50 46L4 26Z" fill="#1b0d33" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>' +
    '<path d="M50 26L86 31V64" fill="none" stroke="#ffb347" stroke-width="3" stroke-linecap="round"/><circle cx="86" cy="66" r="4" fill="#ffb347"/></symbol></svg>' +
    '<i class="gr-sun"></i><i class="gr-cloud gr-c1"></i><i class="gr-cloud gr-c2"></i><i class="gr-cloud gr-c3"></i>' +
    '<i class="gr-ring gr-r1"></i><i class="gr-ring gr-r2"></i><i class="gr-ring gr-r3"></i>';
  for (let i = 0; i < 7; i++) {
    const s = 44 + r() * 46;
    h += `<svg class="gr-cap" viewBox="0 0 100 80" style="left:${f(4 + (i * 13.4) % 92)}%;width:${f(s)}px;height:${f(s * 0.8)}px;animation-duration:${f(20 + r() * 16)}s;animation-delay:-${f(r() * 30)}s;--dx:${f((r() - 0.5) * 220)}px"><use href="#gr-cap"/></svg>`;
  }
  for (let i = 0; i < 10; i++) {
    const s = 12 + r() * 16;
    h += `<i class="gr-sp" style="left:${f(r() * 100)}%;top:${f(r() * 90)}%;width:${f(s)}px;height:${f(s)}px;animation-delay:-${f(r() * 4)}s"></i>`;
  }
  return h;
}

/* ------------------------------ Astroworld : ciel, guirlande, pop-corn ------------------------------ */
function bunting(): string {
  return once('bunting', () => {
    const cols = ['#ff3b3b', '#ffd23f', '#2d7bff', '#ffffff'];
    let rope = '';
    let flags = '';
    let n = 0;
    for (let k = 0; k < 4; k++) {
      const x0 = k * 400;
      const [x1, y1, x2] = [x0 + 200, 92, x0 + 400];
      rope += `${k ? '' : `M${x0} 8`}Q${x1} ${y1} ${x2} 8`;
      for (let j = 0; j < 9; j++) {
        const t = (j + 0.5) / 9;
        const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * x1 + t * t * x2;
        const py = (1 - t) * (1 - t) * 8 + 2 * (1 - t) * t * y1 + t * t * 8;
        const dx = 2 * (1 - t) * (x1 - x0) + 2 * t * (x2 - x1);
        const dy = 2 * (1 - t) * (y1 - 8) + 2 * t * (8 - y1);
        const L = Math.hypot(dx, dy);
        const tx = dx / L;
        const ty = dy / L;
        const nx = -ty;
        const ny = tx;
        const c = cols[n++ % 4];
        flags += `<path d="M${f(px - tx * 15)} ${f(py - ty * 15)}L${f(px + tx * 15)} ${f(py + ty * 15)}L${f(px + nx * 40)} ${f(py + ny * 40)}Z" fill="${c}" stroke="#1d3b7a" stroke-opacity=".35" stroke-width="1.5"/>`;
      }
    }
    return `<svg class="as-bunting" viewBox="0 0 1600 140" preserveAspectRatio="xMidYMin slice"><path d="${rope}" fill="none" stroke="#5a3a2a" stroke-width="3"/>${flags}</svg>`;
  });
}

function wheel(): string {
  let spokes = '';
  let cars = '';
  const cols = ['#ff3b3b', '#ffd23f', '#2d7bff', '#ffffff'];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = 150 + Math.cos(a) * 128;
    const y = 150 + Math.sin(a) * 128;
    spokes += `M150 150L${f(x)} ${f(y)}`;
    cars += `<circle cx="${f(x)}" cy="${f(y)}" r="9" fill="${cols[i % 4]}" stroke="#fff" stroke-width="2"/>`;
  }
  return (
    '<svg class="as-wheel" viewBox="0 0 300 330"><path d="M150 150L96 322M150 150L204 322M118 250H182" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"/>' +
    `<g class="as-wheel-rot"><circle cx="150" cy="150" r="128" fill="none" stroke="#fff" stroke-width="4"/><circle cx="150" cy="150" r="96" fill="none" stroke="#fff" stroke-width="2" stroke-opacity=".7"/><path d="${spokes}" stroke="#fff" stroke-width="2.5" fill="none"/>${cars}</g><circle cx="150" cy="150" r="9" fill="#ffd23f"/></svg>`
  );
}

function astro(): string {
  const r = rng(71);
  let h = '<i class="as-rays"></i><i class="as-glow"></i>';
  const clouds: [number, number, number, number][] = [[2, 8, 420, 60], [58, 4, 360, 74], [-4, 58, 460, 82], [70, 66, 400, 66], [34, 78, 380, 90]];
  clouds.forEach(([x, y, w, d], i) => {
    h += `<i class="as-cloud" style="left:${x}%;top:${y}%;width:${w}px;height:${f(w * 0.4)}px;animation-duration:${d}s;animation-delay:-${i * 9}s"></i>`;
  });
  h += wheel() + bunting();
  for (let i = 0; i < 13; i++) {
    const s = 18 + r() * 14;
    h += `<i class="as-pop" style="left:${f(r() * 100)}%;width:${f(s)}px;height:${f(s)}px;animation-duration:${f(11 + r() * 11)}s;animation-delay:-${f(r() * 20)}s;--dx:${f((r() - 0.5) * 140)}px"></i>`;
  }
  return h;
}

/* ------------------------------ More Chaos : éclaboussures de sang sur plâtre ------------------------------ */
function blot(seed: number): { d: string; dots: [number, number, number][] } {
  const r = rng(seed);
  const N = 40;
  const P: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    let rad = 120 + r() * 70;
    if (i % 4 === 0) rad *= 1.5 + r() * 1.2;
    P.push([400 + Math.cos(a) * rad, 400 + Math.sin(a) * rad]);
  }
  const mid = (p: [number, number], q: [number, number]): [number, number] => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  let d = `M${f(mid(P[0], P[1])[0])} ${f(mid(P[0], P[1])[1])}`;
  for (let i = 1; i <= N; i++) {
    const p = P[i % N];
    const m = mid(p, P[(i + 1) % N]);
    d += `Q${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])}`;
  }
  const dots: [number, number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2;
    const dist = 220 + r() * 170;
    dots.push([400 + Math.cos(a) * dist, 400 + Math.sin(a) * dist, Math.max(3, 18 - dist / 26 + r() * 6)]);
  }
  return { d: d + 'Z', dots };
}

function chaos(): string {
  let h = '<i class="ch-light"></i>';
  const spots: [number, number, number, number, number, number][] = [
    [4, 8, 300, 0, 1, 18], [70, 6, 220, 4, 2, 20], [86, 52, 340, 9, 3, 22], [14, 62, 260, 13, 4, 19], [44, 78, 200, 6, 5, 21], [58, 26, 180, 15, 6, 24], [30, 30, 150, 11, 7, 23],
  ];
  spots.forEach(([x, y, s, delay, seed, dur]) => {
    const b = blot(seed * 17);
    h +=
      `<svg class="ch-blot" viewBox="0 0 800 800" style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;animation-duration:${dur}s;animation-delay:-${delay}s">` +
      `<path d="${b.d}" fill="#a80a18"/>` +
      b.dots.map(([cx, cy, rr]) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rr)}" fill="#a80a18"/>`).join('') +
      '</svg>';
  });
  const r = rng(83);
  for (let i = 0; i < 8; i++) {
    h += `<i class="ch-drip" style="left:${f(r() * 100)}%;height:${f(16 + r() * 26)}vh;animation-duration:${f(6 + r() * 7)}s;animation-delay:-${f(r() * 12)}s"></i>`;
  }
  return h;
}

/* ------------------------------ Winamp : barres LED qui suivent la lecture ------------------------------ */
function winamp(): string {
  const r = rng(101);
  let bars = '';
  for (let i = 0; i < 40; i++) {
    bars += `<i class="wa-b wa-v${i % 4}" style="animation-duration:${f(0.7 + r() * 1.1)}s;animation-delay:-${f(r() * 2)}s"></i>`;
  }
  return `<div class="wa-wrap"><div class="wa-amp">${bars}</div></div>`;
}

/* ------------------------------ iMac G3 : bonbons translucides ------------------------------ */
function imac(): string {
  const blobs: [string, number, number, number, number][] = [
    ['#ff4f6d', 8, 14, 280, 52], ['#a259ff', 74, 8, 220, 44], ['#7ed957', 62, 62, 300, 58], ['#ffb300', 16, 66, 240, 48], ['#2f9bff', 40, 36, 200, 40],
  ];
  return blobs
    .map(([c, x, y, s, d], i) => `<i class="im-blob" style="--c:${c};left:${x}%;top:${y}%;width:${s}px;height:${s}px;animation-duration:${d}s;animation-delay:-${i * 8}s"></i>`)
    .join('');
}

export function albumMarkup(id: AlbumDecorId): string {
  return once(`album-${id}`, () => {
    switch (id) {
      case 'pinktape': return pinktape();
      case 'wlr': return wlr();
      case 'fancy': return fancy();
      case 'tlop': return tlop();
      case 'grad': return grad();
      case 'astro': return astro();
      case 'chaos': return chaos();
      case 'winamp': return winamp();
      case 'imac': return imac();
    }
  });
}
