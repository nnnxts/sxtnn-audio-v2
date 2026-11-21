import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { CoverStyle, Density, ThemeId, User } from '../lib/types';
import { useAuth } from './AuthContext';
import { customVars } from '../lib/palette';
import type { AlbumDecorId } from '../lib/albumGen';

export interface Appearance {
  theme: ThemeId;
  density: Density;
  coverStyle: CoverStyle;
  /** Couleur des boutons choisie (hex) ; null = celle du thème */
  accent: string | null;
  /** Deuxième couleur du dégradé (hex) ; null = teinte voisine automatique */
  accent2: string | null;
  /** Adapte la page d'une sortie aux couleurs de sa pochette */
  adaptRelease: boolean;
  /** Adapte la barre de lecture aux couleurs de la pochette en cours */
  adaptPlayer: boolean;
  /** Animations du fond (bulles, haut-parleurs…) ; à couper sur un appareil lent */
  fx: boolean;
}

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  description: string;
  /** [fond, surface, accent, accent secondaire] pour l'aperçu */
  swatch: [string, string, string, string];
  group: 'classic' | 'retro' | 'apps' | 'color' | 'albums';
  /** thème avec un décor de fond (calque fixe) */
  deco?: boolean;
  animated?: boolean;
  /** décor animé en éléments (voir ThemeDecor) */
  decor?: 'aero' | 'metro' | 'vapor' | 'retromac' | AlbumDecorId;
}

export const THEME_GROUPS: { id: ThemeMeta['group']; label: string }[] = [
  { id: 'classic', label: 'Classiques' },
  { id: 'retro', label: 'Rétro & Aero' },
  { id: 'apps', label: 'Façon plateformes' },
  { id: 'color', label: 'Ambiances & couleurs' },
  { id: 'albums', label: 'Inspirés d\'albums' },
];

export const THEMES: ThemeMeta[] = [
  { id: 'oled', group: 'classic', label: 'Sombre OLED', description: 'Noir pur, violet électrique', swatch: ['#09090b', '#18181d', '#8b2bff', '#d946ef'] },
  { id: 'light', group: 'classic', label: 'Clair Minimaliste', description: 'Blanc pur, cartes gris perle', swatch: ['#ffffff', '#f1f1f5', '#7c3aed', '#c026d3'] },
  { id: 'midnight', group: 'classic', label: 'Discord Midnight', description: 'Gris ardoise, accents blurple', swatch: ['#1e1f22', '#2b2d31', '#5865f2', '#eb459e'] },
  { id: 'neon', group: 'classic', label: 'Néon Cyber', description: 'Bleu nuit, reflets magenta et cyan', swatch: ['#06081c', '#12163a', '#ff2ec4', '#22e6ff'] },
  { id: 'emerald', group: 'classic', label: 'Émeraude Studio', description: 'Anthracite chaud, vert vif', swatch: ['#161513', '#282623', '#1ed760', '#19aa6e'] },

  { id: 'aero', group: 'retro', deco: true, animated: true, decor: 'aero', label: 'Frutiger Aero', description: 'Ciel, bulles qui montent, herbe qui ondule', swatch: ['#c8e8fa', '#ffffff', '#0e8ce6', '#34cd9e'] },
  { id: 'metro', group: 'retro', deco: true, animated: true, decor: 'metro', label: 'Frutiger Metro', description: 'Y2K : cercles, étoiles, haut-parleurs qui pulsent', swatch: ['#0c0618', '#1e0e36', '#ff3daa', '#a05aff'] },
  { id: 'aquametro', group: 'retro', deco: true, animated: true, label: 'Metro Aqua', description: 'Tuiles plates, lueurs aqua animées', swatch: ['#031a2a', '#093650', '#00d68f', '#00a8ff'] },
  { id: 'xp', group: 'retro', deco: true, label: 'Windows 7', description: 'Verre bleu ciel, beige, boutons brillants', swatch: ['#ece9d8', '#ffffff', '#245edc', '#4a90ff'] },
  { id: 'winxp', group: 'retro', deco: true, label: 'Windows XP', description: 'Luna bleu, colline verte, bouton Démarrer', swatch: ['#ece9d8', '#ffffff', '#0054e3', '#3d95ff'] },
  { id: 'vaporwave', group: 'retro', deco: true, animated: true, decor: 'vapor', label: 'Vaporwave', description: 'Soleil rétro, grille néon qui défile', swatch: ['#14082c', '#2e165c', '#ff71ce', '#01cdfe'] },
  { id: 'retromac', group: 'retro', deco: true, animated: true, decor: 'retromac', label: 'Mac Rétro 80s', description: 'Pastel rose, soleil rayé, sol en damier', swatch: ['#ffbed6', '#ffffff', '#ff3d9a', '#00c4dc'] },
  { id: 'win95', group: 'retro', deco: true, label: 'Windows 95', description: 'Gris relief, boutons biseautés, bleu marine', swatch: ['#c0c0c0', '#dfdfdf', '#000080', '#1084d0'] },
  { id: 'winamp', group: 'retro', deco: true, animated: true, decor: 'winamp', label: 'Winamp', description: 'Métal sombre, barres LED qui suivent la lecture', swatch: ['#0e1016', '#222836', '#00f060', '#ffcc00'] },
  { id: 'gameboy', group: 'retro', deco: true, label: 'Game Boy', description: 'Quatre verts, pixels, police console', swatch: ['#8bac0f', '#9bbc0f', '#0f380f', '#306230'] },
  { id: 'imac', group: 'retro', deco: true, animated: true, decor: 'imac', label: 'iMac G3', description: 'Bleu Bondi, bonbons translucides qui flottent', swatch: ['#c8eaf0', '#ffffff', '#0096be', '#6ed6e8'] },
  { id: 'terminal', group: 'retro', deco: true, label: 'Terminal', description: 'Écran vert, police console', swatch: ['#010802', '#081c0a', '#39ff6e', '#8cff5a'] },

  { id: 'spotify', group: 'apps', label: 'Façon Spotify', description: 'Gris profond, vert vif uni', swatch: ['#121212', '#282828', '#1ed760', '#1ed760'] },
  { id: 'apple', group: 'apps', label: 'Façon Apple Music', description: 'Blanc lumineux, rouge-rose', swatch: ['#ffffff', '#f2f2f7', '#fa2d48', '#ff5578'] },
  { id: 'apple-dark', group: 'apps', label: 'Apple Music Sombre', description: 'Noir profond, rouge-rose', swatch: ['#000000', '#242426', '#fa2d48', '#ff5578'] },
  { id: 'glass', group: 'apps', deco: true, label: 'Liquid Glass', description: 'Verre translucide, halos colorés', swatch: ['#090b1a', '#1e2442', '#6e96ff', '#c878ff'] },

  { id: 'sunset', group: 'color', deco: true, label: 'Coucher de soleil', description: 'Orange brûlé et rose', swatch: ['#1a0b16', '#341628', '#ff6b35', '#ff2d78'] },
  { id: 'ocean', group: 'color', deco: true, label: 'Océan', description: 'Bleu abyssal, cyan lumineux', swatch: ['#041424', '#082036', '#00beff', '#3878ff'] },
  { id: 'rose', group: 'color', deco: true, label: 'Rose Poudré', description: 'Clair, doux et rosé', swatch: ['#fff4f7', '#fce4ec', '#ec4899', '#fb7185'] },
  { id: 'mocha', group: 'color', label: 'Mocha', description: 'Pastel sombre, mauve', swatch: ['#1e1e2e', '#313244', '#cba6f7', '#f5c2e7'] },
  { id: 'nord', group: 'color', label: 'Nord', description: 'Bleu glacier, sobre', swatch: ['#2e3440', '#434c5e', '#88c0d0', '#81a1c1'] },
  { id: 'mono', group: 'color', label: 'Monochrome', description: 'Noir, blanc, contraste maximal', swatch: ['#000000', '#161616', '#f5f5f5', '#bebebe'] },
  { id: 'gold', group: 'color', label: 'Noir & Or', description: 'Luxe discret, reflets dorés', swatch: ['#0a0804', '#1e180c', '#d4af37', '#f7dc82'] },

  { id: 'pinktape', group: 'albums', deco: true, animated: true, decor: 'pinktape', label: 'Pink Tape', description: 'Drapeau rose qui ondule, étoiles qui scintillent', swatch: ['#ffe1ee', '#ffffff', '#ff2896', '#ff78be'] },
  { id: 'wlr', group: 'albums', deco: true, animated: true, decor: 'wlr', label: 'Whole Lotta Red', description: 'Noir punk, rouge qui coule, grain qui tremble', swatch: ['#080303', '#1c0608', '#e81824', '#ff4e3a'] },
  { id: 'fancythat', group: 'albums', deco: true, animated: true, decor: 'fancy', label: 'Fancy That', description: 'Rouge grunge, couronne dorée, pétales de rose', swatch: ['#22040a', '#440c16', '#f0be46', '#ff788c'] },
  { id: 'tlop', group: 'albums', deco: true, animated: true, decor: 'tlop', label: 'The Life of Pablo', description: 'Aplat saumon, lignes de texte noir qui défilent', swatch: ['#f4895a', '#fff4e8', '#0c0c0c', '#464646'] },
  { id: 'graduation', group: 'albums', deco: true, animated: true, decor: 'grad', label: 'Graduation', description: 'Ciel violet-rose, anneaux, toques qui tombent', swatch: ['#1e0c38', '#3a1862', '#ff3296', '#ffa642'] },
  { id: 'astroworld', group: 'albums', deco: true, animated: true, decor: 'astro', label: 'Astroworld', description: 'Ciel bleu, guirlande, pop-corn, soleil doré', swatch: ['#bedeff', '#ffffff', '#ff9e12', '#ff523c'] },
  { id: 'morechaos', group: 'albums', deco: true, animated: true, decor: 'chaos', label: 'More Chaos', description: 'Mur de plâtre, éclaboussures de sang qui giclent', swatch: ['#f6f5f3', '#ffffff', '#b00a18', '#70040c'] },
];

const STORAGE_KEY = 'sxtnn.appearance';
const DEFAULT_APPEARANCE: Appearance = {
  theme: 'oled',
  density: 'comfortable',
  coverStyle: 'rounded',
  accent: null,
  accent2: null,
  adaptRelease: false,
  adaptPlayer: false,
  fx: true,
};

const HEX_RE = /^#[0-9a-f]{6}$/i;

const THEME_IDS = THEMES.map((t) => t.id);

function load(): Appearance {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<Appearance>;
    return {
      theme: THEME_IDS.includes(raw.theme as ThemeId) ? (raw.theme as ThemeId) : DEFAULT_APPEARANCE.theme,
      density: raw.density === 'compact' ? 'compact' : 'comfortable',
      coverStyle: raw.coverStyle === 'square' ? 'square' : 'rounded',
      accent: typeof raw.accent === 'string' && HEX_RE.test(raw.accent) ? raw.accent : null,
      accent2: typeof raw.accent2 === 'string' && HEX_RE.test(raw.accent2) ? raw.accent2 : null,
      adaptRelease: raw.adaptRelease === true,
      adaptPlayer: raw.adaptPlayer === true,
      fx: raw.fx !== false,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function apply(a: Appearance) {
  const root = document.documentElement;

  // Décor de fond propre au thème + couleur des boutons choisie : sans effet sur les pages
  // SXTNN DISTRO (le CSS les ignore tant que data-force-theme est présent), donc on les applique toujours.
  const meta = THEMES.find((t) => t.id === a.theme);
  if (meta?.deco) root.setAttribute('data-deco', '1');
  else root.removeAttribute('data-deco');

  const vars = a.accent ? customVars(a.accent, a.accent2) : null;
  for (const k of ['--c-accent', '--c-accent2', '--c-onaccent']) root.style.removeProperty(k);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    root.setAttribute('data-custom', '1');
  } else {
    root.removeAttribute('data-custom');
  }

  // Animations du fond : coupées si la personne l'a demandé (appareil lent)
  if (a.fx) root.removeAttribute('data-fx');
  else root.setAttribute('data-fx', '0');

  // Les pages SXTNN DISTRO imposent le thème sombre : on ne l'écrase pas
  if (root.hasAttribute('data-force-theme')) return;
  root.setAttribute('data-theme', a.theme);
  root.setAttribute('data-density', a.density);
  root.setAttribute('data-cover', a.coverStyle);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', meta?.swatch[0] || '#09090b');
}

interface ThemeApi {
  appearance: Appearance;
  setAppearance: (patch: Partial<Appearance>) => void;
  appearanceOpen: boolean;
  openAppearance: () => void;
  closeAppearance: () => void;
}

const ThemeContext = createContext<ThemeApi | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth();
  const [appearance, setAppearanceState] = useState<Appearance>(load);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const syncTimer = useRef<number | null>(null);
  const lastUserId = useRef<number | null>(null);

  useEffect(() => {
    apply(appearance);
    // La barre d'état du téléphone prend la couleur du thème
    try {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().split(/\s+/).join(',');
      if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${bg})`);
    } catch {
      /* ignoré */
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
    } catch {
      /* stockage indisponible */
    }
  }, [appearance]);

  const current = useRef<Appearance>(appearance);
  current.current = appearance;

  const pushToAccount = useCallback(
    (next: Appearance) => {
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
      syncTimer.current = window.setTimeout(() => {
        api
          .patch<{ user: User }>('/auth/me', {
            theme_preference: next.theme,
            density_preference: next.density,
            cover_style: next.coverStyle,
          })
          .then((res) => setUser(res.user))
          .catch(() => {
            /* la préférence reste enregistrée localement */
          });
      }, 500);
    },
    [setUser]
  );

  // À la connexion : on adopte les préférences du compte. Un compte neuf (réglages par défaut)
  // récupère au contraire l'apparence choisie avant l'inscription.
  useEffect(() => {
    if (!user) {
      lastUserId.current = null;
      return;
    }
    if (lastUserId.current === user.id) return;
    lastUserId.current = user.id;

    const accountIsDefault =
      user.theme_preference === 'oled' && user.density_preference === 'comfortable' && user.cover_style === 'rounded';
    const local = current.current;
    const localIsDefault = local.theme === 'oled' && local.density === 'comfortable' && local.coverStyle === 'rounded';

    if (accountIsDefault && !localIsDefault) {
      pushToAccount(local);
      return;
    }
    setAppearanceState({
      ...current.current,
      theme: THEME_IDS.includes(user.theme_preference) ? user.theme_preference : 'oled',
      density: user.density_preference === 'compact' ? 'compact' : 'comfortable',
      coverStyle: user.cover_style === 'square' ? 'square' : 'rounded',
    });
  }, [user, pushToAccount]);

  const setAppearance = useCallback(
    (patch: Partial<Appearance>) => {
      const next = { ...current.current, ...patch };
      current.current = next;
      setAppearanceState(next);
      if (user) pushToAccount(next);
    },
    [user, pushToAccount]
  );

  const value = useMemo<ThemeApi>(
    () => ({
      appearance,
      setAppearance,
      appearanceOpen,
      openAppearance: () => setAppearanceOpen(true),
      closeAppearance: () => setAppearanceOpen(false),
    }),
    [appearance, setAppearance, appearanceOpen]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeApi {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme doit être utilisé dans <ThemeProvider>');
  return ctx;
}
