import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Charge une URL d'API. Repasse en chargement quand `path` change.
 * path = null -> ne charge rien.
 */
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [state, setState] = useState<ApiState<T>>({ data: null, error: null, loading: path !== null });
  const [tick, setTick] = useState(0);
  const keyRef = useRef<string>('');

  useEffect(() => {
    if (path === null) {
      keyRef.current = '';
      setState({ data: null, error: null, loading: false });
      return;
    }
    const controller = new AbortController();
    // Nouvelle adresse (ou nouvelles dépendances) : on efface l'ancien contenu.
    // Simple rechargement (reload) : on garde l'ancien contenu affiché pendant le chargement.
    const key = JSON.stringify([path, ...deps]);
    if (keyRef.current !== key) {
      keyRef.current = key;
      setState({ data: null, error: null, loading: true });
    } else {
      setState((s) => ({ ...s, loading: true, error: null }));
    }
    api
      .get<T>(path, controller.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setState({ data: null, error: err.message || 'Erreur de chargement.', loading: false });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback(
    (updater: T | null | ((prev: T | null) => T | null)) =>
      setState((s) => ({ ...s, data: typeof updater === 'function' ? (updater as (p: T | null) => T | null)(s.data) : updater })),
    []
  );

  return { ...state, reload, setData };
}

export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · SXTNN AUDIO` : 'SXTNN AUDIO';
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export function useClickOutside<T extends HTMLElement>(handler: () => void, active = true) {
  const ref = useRef<T | null>(null);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handlerRef.current();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [active]);

  return ref;
}

export function useDebounced<T>(value: T, delay = 220): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
