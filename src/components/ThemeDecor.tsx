import { memo, useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import { THEMES, useTheme } from '../context/ThemeContext';
import { usePlayer } from '../context/PlayerContext';
import { AERO_BUBBLES, METRO_SPARKS, STAR_POINTS, city, grass, splat } from '../lib/decorGen';
import { albumMarkup, type AlbumDecorId } from '../lib/albumGen';

/**
 * Décors animés des thèmes (bulles, herbe, haut-parleurs…).
 *
 * Règles de légèreté :
 * - seulement transform / opacity (animées par le GPU, aucun recalcul de mise en page) ;
 * - quelques dizaines d'éléments au total, formes en SVG calculées une fois ;
 * - un seul décor est monté à la fois, et rien du tout si le thème n'en a pas ;
 * - le réglage « Animations du fond » (Apparence) les coupe entièrement.
 */

/* ------------------------------ Haut-parleurs ------------------------------ */

/**
 * Fait « pomper » les haut-parleurs pendant la lecture, et les arrête en douceur à la pause.
 * L'intensité (0 → 1) monte et redescend progressivement ; la boucle s'éteint toute seule quand elle retombe à 0.
 * Le rythme est simulé (léger, sans analyse audio) : il n'est pas calé sur le tempo exact du titre.
 */
function useSpeakerBeat(root: RefObject<HTMLDivElement>, playing: boolean, enabled: boolean) {
  const amp = useRef(0);
  useEffect(() => {
    const host = root.current;
    if (!enabled || !host) return;
    if (!playing && amp.current < 0.002) return;
    const targets = Array.from(host.querySelectorAll<HTMLElement>('.mt-spk, .wa-amp'));
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 33) return; // ~30 images par seconde suffisent
      const dt = Math.min(0.12, last ? (now - last) / 1000 : 0.033);
      last = now;
      amp.current += ((playing ? 1 : 0) - amp.current) * (1 - Math.exp(-dt / (playing ? 0.16 : 0.5)));
      let k = 0;
      if (amp.current >= 0.002) {
        const s = now / 1000;
        const kick = Math.pow(Math.max(0, Math.sin(s * Math.PI * 2 * 2.05)), 3);
        const snare = 0.45 * Math.pow(Math.max(0, Math.sin(s * Math.PI * 2 * 1.025 + 1.57)), 6);
        const hat = 0.22 * Math.pow(Math.max(0, Math.sin(s * Math.PI * 2 * 4.1 + 0.8)), 2);
        k = amp.current * Math.min(1, 0.12 + kick * 0.85 + snare + hat);
      } else {
        amp.current = 0;
      }
      const v = k.toFixed(3);
      for (const el of targets) el.style.setProperty('--k', v);
      if (!playing && amp.current === 0) cancelAnimationFrame(raf);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [root, playing, enabled]);
}

function Speaker({ side }: { side: 'l' | 'r' }) {
  return (
    <div className={`mt-spk mt-spk-${side}`}>
      <div className="mt-halo" />
      <div className="mt-box">
        <i className="mt-tweeter" />
        <i className="mt-woofer">
          <b className="mt-cone" />
          <b className="mt-cap" />
        </i>
      </div>
    </div>
  );
}

/* ------------------------------ Décors par thème ------------------------------ */

function AeroDecor() {
  return (
    <div className="tdecor tdecor-aero" aria-hidden>
      <i className="ae-cloud ae-c1" />
      <i className="ae-cloud ae-c2" />
      <i className="ae-cloud ae-c3" />
      {AERO_BUBBLES.map((b, i) => (
        <i
          key={i}
          className="ae-bub"
          style={{ left: `${b.x}%`, width: b.s, height: b.s, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s`, '--dx': `${b.dx}px` } as CSSProperties}
        />
      ))}
      <svg className="ae-grass ae-back" viewBox="0 0 1600 200" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="ae-gb" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#3f9d3a" />
            <stop offset="1" stopColor="#a6e46a" />
          </linearGradient>
        </defs>
        <path d={grass('back')} fill="url(#ae-gb)" />
      </svg>
      <svg className="ae-grass ae-front" viewBox="0 0 1600 200" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="ae-gf" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#2f8a2e" />
            <stop offset="1" stopColor="#7ed34f" />
          </linearGradient>
        </defs>
        <path d={grass('front')} fill="url(#ae-gf)" />
      </svg>
    </div>
  );
}

/** Cercles concentriques façon vecteur des années 2000 (noir, blanc, anneaux translucides). */
function Rings({ className }: { className: string }) {
  return (
    <svg className={`mt-art ${className}`} viewBox="0 0 600 600" aria-hidden>
      <circle cx="300" cy="300" r="290" fill="#000" fillOpacity=".72" />
      <circle cx="300" cy="300" r="238" fill="#fff" fillOpacity=".52" />
      <circle cx="300" cy="300" r="176" fill="#fff" fillOpacity=".2" />
      <circle cx="300" cy="300" r="132" fill="#000" fillOpacity=".1" />
      <circle cx="300" cy="300" r="84" fill="#fff" fillOpacity=".3" />
      <circle cx="300" cy="300" r="40" fill="#000" fillOpacity=".72" />
    </svg>
  );
}

function Star({ className }: { className: string }) {
  return (
    <svg className={`mt-star ${className}`} viewBox="0 0 100 100" aria-hidden>
      <polygon points={STAR_POINTS} fill="#000" fillOpacity=".88" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}

function MetroDecor({ playing, fx }: { playing: boolean; fx: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useSpeakerBeat(root, playing, fx);
  const sp = splat();
  const ct = city();
  return (
    <div ref={root} className="tdecor tdecor-metro" data-playing={playing ? '1' : '0'} aria-hidden>
      <i className="mt-field mt-f1" />
      <i className="mt-field mt-f2" />
      <i className="mt-field mt-f3" />
      <i className="mt-dots" />
      <svg className="mt-splat" viewBox="0 0 800 800">
        <path d={sp.d} fill="#000" fillOpacity=".88" />
        {sp.dots.map((d, i) => (
          <circle key={i} cx={d.x.toFixed(1)} cy={d.y.toFixed(1)} r={d.r.toFixed(1)} fill="#000" fillOpacity=".88" />
        ))}
      </svg>
      <Rings className="mt-art-a" />
      <Rings className="mt-art-b" />
      <svg className="mt-city" viewBox="0 0 1200 200" preserveAspectRatio="xMidYMax slice">
        <path d={ct.buildings} fill="#05010c" fillOpacity=".92" />
        <path d={ct.windows} fill="#fff" fillOpacity=".55" />
      </svg>
      <Star className="mt-s1" />
      <Star className="mt-s2" />
      <Star className="mt-s3" />
      <Speaker side="l" />
      <Speaker side="r" />
      <div className="mt-sparks">
        {METRO_SPARKS.map((p, i) => (
          <i
            key={i}
            className={`mt-spark mt-sp-${p.c}`}
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s * 1.7, height: p.s * 1.7, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function VaporDecor() {
  return (
    <div className="tdecor tdecor-vapor" aria-hidden>
      <i className="vp-sun" />
      <i className="vp-shape vp-tri" />
      <i className="vp-shape vp-ring" />
      <i className="vp-shape vp-sq" />
      <div className="vp-floor">
        <i className="vp-grid" />
      </div>
    </div>
  );
}

function RetroMacDecor() {
  return (
    <div className="tdecor tdecor-retromac" aria-hidden>
      <i className="rm-sun" />
      <i className="rm-shape rm-tri" />
      <i className="rm-shape rm-diamond" />
      <i className="rm-shape rm-ring" />
      <div className="rm-floor">
        <i className="rm-checker" />
      </div>
    </div>
  );
}

/**
 * Décors des thèmes d'albums et de quelques thèmes rétro : le contenu est un texte HTML/SVG constant
 * (voir lib/albumGen.ts), calculé une fois. Winamp réutilise l'intensité douce des haut-parleurs.
 */
const ALBUM_IDS = ['pinktape', 'wlr', 'fancy', 'tlop', 'grad', 'astro', 'chaos', 'winamp', 'imac'];

function AlbumDecor({ id, playing, fx }: { id: AlbumDecorId; playing: boolean; fx: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useSpeakerBeat(root, playing, fx && id === 'winamp');
  return (
    <div
      ref={root}
      className={`tdecor tdecor-album tdecor-${id}`}
      data-playing={playing ? '1' : '0'}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: albumMarkup(id) }}
    />
  );
}

/* ------------------------------ Point d'entrée ------------------------------ */

function ThemeDecorInner() {
  const { appearance } = useTheme();
  const { isPlaying } = usePlayer();
  const meta = THEMES.find((t) => t.id === appearance.theme);
  if (!meta?.decor || !appearance.fx) return null;
  switch (meta.decor) {
    case 'aero':
      return <AeroDecor />;
    case 'metro':
      return <MetroDecor playing={isPlaying} fx={appearance.fx} />;
    case 'vapor':
      return <VaporDecor />;
    case 'retromac':
      return <RetroMacDecor />;
    default:
      return ALBUM_IDS.includes(meta.decor) ? <AlbumDecor key={meta.decor} id={meta.decor as AlbumDecorId} playing={isPlaying} fx={appearance.fx} /> : null;
  }
}

export const ThemeDecor = memo(ThemeDecorInner);
