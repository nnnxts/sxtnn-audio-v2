import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { CoverStyle, Density, ThemeId, User } from '../lib/types';
import { useAuth } from './AuthContext';

export interface Appearance {
  theme: ThemeId;
  density: Density;
  coverStyle: CoverStyle;
}

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  description: string;
  /** [fond, surface, accent, accent secondaire] pour l'aperçu */
  swatch: [string, string, string, string];
}

export const THEMES: ThemeMeta[] = [
  { id: 'oled', label: 'Sombre OLED', description: 'Noir pur, violet électrique', swatch: ['#09090b', '#18181d', '#8b2bff', '#d946ef'] },
  { id: 'light', label: 'Clair Minimaliste', description: 'Blanc pur, cartes gris perle', swatch: ['#ffffff', '#f1f1f5', '#7c3aed', '#c026d3'] },
  { id: 'midnight', label: 'Discord Midnight', description: 'Gris ardoise, accents blurple', swatch: ['#1e1f22', '#2b2d31', '#5865f2', '#eb459e'] },
  { id: 'neon', label: 'Néon Cyber', description: 'Bleu nuit, reflets magenta et cyan', swatch: ['#06081c', '#12163a', '#ff2ec4', '#22e6ff'] },
  { id: 'emerald', label: 'Émeraude Studio', description: 'Anthracite chaud, vert vif', swatch: ['#161513', '#282623', '#1ed760', '#19aa6e'] },
];

const STORAGE_KEY = 'sxtnn.appearance';
const DEFAULT_APPEARANCE: Appearance = { theme: 'oled', density: 'comfortable', coverStyle: 'rounded' };

const THEME_IDS = THEMES.map((t) => t.id);

function load(): Appearance {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<Appearance>;
    return {
      theme: THEME_IDS.includes(raw.theme as ThemeId) ? (raw.theme as ThemeId) : DEFAULT_APPEARANCE.theme,
      density: raw.density === 'compact' ? 'compact' : 'comfortable',
      coverStyle: raw.coverStyle === 'square' ? 'square' : 'rounded',
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function apply(a: Appearance) {
  const root = document.documentElement;
  // Les pages SXTNN DISTRO imposent le thème sombre : on ne l'écrase pas
  if (root.hasAttribute('data-force-theme')) return;
  root.setAttribute('data-theme', a.theme);
  root.setAttribute('data-density', a.density);
  root.setAttribute('data-cover', a.coverStyle);
  const bg = THEMES.find((t) => t.id === a.theme)?.swatch[0];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#09090b');
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
