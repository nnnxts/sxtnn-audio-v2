import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, tokens } from '../lib/api';
import type { User } from '../lib/types';
import { useToast } from './ToastContext';

interface AuthApi {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (form: FormData) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  authOpen: boolean;
  authReason: string | null;
  openAuth: (reason?: string) => void;
  closeAuth: () => void;
  /** Retourne true si connecté, sinon ouvre la fenêtre de connexion et retourne false. */
  requireAuth: (reason?: string) => boolean;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!tokens.getUser());
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string | null>(null);

  // Restaure la session au chargement
  useEffect(() => {
    if (!tokens.getUser()) {
      setLoading(false);
      return;
    }
    let alive = true;
    api
      .get<{ user: User }>('/auth/me')
      .then((res) => alive && setUserState(res.user))
      .catch(() => {
        tokens.setUser(null);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const logout = useCallback(() => {
    tokens.setUser(null);
    setUserState(null);
  }, []);

  // Jeton refusé par le serveur : on déconnecte proprement
  useEffect(() => {
    const onUnauthorized = (e: Event) => {
      const kind = (e as CustomEvent<{ kind: string }>).detail?.kind;
      if (kind === 'user' && tokens.getUser()) {
        tokens.setUser(null);
        setUserState(null);
        toast('Votre session a expiré. Reconnectez-vous.', 'info');
      }
    };
    window.addEventListener('sxtnn:unauthorized', onUnauthorized);
    return () => window.removeEventListener('sxtnn:unauthorized', onUnauthorized);
  }, [toast]);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', { identifier, password });
    tokens.setUser(res.token);
    setUserState(res.user);
  }, []);

  const register = useCallback(async (form: FormData) => {
    const res = await api.post<{ token: string; user: User }>('/auth/register', form);
    tokens.setUser(res.token);
    setUserState(res.user);
  }, []);

  const openAuth = useCallback((reason?: string) => {
    setAuthReason(reason ?? null);
    setAuthOpen(true);
  }, []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  const requireAuth = useCallback(
    (reason?: string) => {
      if (tokens.getUser()) return true;
      openAuth(reason);
      return false;
    },
    [openAuth]
  );

  const value = useMemo<AuthApi>(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      setUser: setUserState,
      authOpen,
      authReason,
      openAuth,
      closeAuth,
      requireAuth,
    }),
    [user, loading, login, register, logout, authOpen, authReason, openAuth, closeAuth, requireAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
