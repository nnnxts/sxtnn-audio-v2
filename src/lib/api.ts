/* ============================================================
 * Client HTTP : ajoute automatiquement le jeton de connexion.
 * Deux sessions indépendantes :
 *  - "user"   : compte auditeur
 *  - "artist" : portail SXTNN DISTRO
 * Aucune URL absolue : tout passe par des chemins relatifs (/api/...)
 * ============================================================ */

const USER_KEY = 'sxtnn.userToken';
const ARTIST_KEY = 'sxtnn.artistToken';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* stockage indisponible */
  }
}

/** Code d'accès artiste, gardé uniquement le temps de la session du navigateur (sert à préremplir backup/restauration). */
export const accessCode = {
  get: () => {
    try {
      return sessionStorage.getItem('sxtnn.adminCode') || '';
    } catch {
      return '';
    }
  },
  set: (code: string | null) => {
    try {
      if (code) sessionStorage.setItem('sxtnn.adminCode', code);
      else sessionStorage.removeItem('sxtnn.adminCode');
    } catch {
      /* stockage indisponible */
    }
  },
};

export const tokens = {
  getUser: () => read(USER_KEY),
  setUser: (t: string | null) => write(USER_KEY, t),
  getArtist: () => read(ARTIST_KEY),
  setArtist: (t: string | null) => write(ARTIST_KEY, t),
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type AuthKind = 'user' | 'artist' | 'none';

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: AuthKind;
  signal?: AbortSignal;
}

function authHeader(kind: AuthKind): Record<string, string> {
  const token = kind === 'user' ? tokens.getUser() : kind === 'artist' ? tokens.getArtist() : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleUnauthorized(kind: AuthKind) {
  if (kind === 'none') return;
  window.dispatchEvent(new CustomEvent('sxtnn:unauthorized', { detail: { kind } }));
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = opts;
  const auth: AuthKind = opts.auth ?? (path.startsWith('/distro') ? 'artist' : 'user');
  const headers: Record<string, string> = { ...authHeader(auth) };
  // Un artiste connecté voit aussi ses propres sorties « amis uniquement » sur le site public
  const artistToken = tokens.getArtist();
  if (artistToken && auth !== 'artist') headers['X-Artist-Token'] = artistToken;
  let payload: BodyInit | undefined;

  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload, signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError('Impossible de joindre le serveur. Vérifiez votre connexion.', 0);
  }

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error || `Erreur ${res.status}`;
    if (res.status === 401 && opts.auth !== 'none') handleUnauthorized(auth);
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/**
 * Envoi de fichiers avec barre de progression (XMLHttpRequest).
 * Utilisé pour publier une sortie : les fichiers audio peuvent être volumineux.
 */
export function uploadForm<T>(
  path: string,
  method: 'POST' | 'PUT',
  form: FormData,
  onProgress?: (percent: number) => void
): Promise<T> {
  const auth: AuthKind = path.startsWith('/distro') ? 'artist' : 'user';
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `/api${path}`);
    const header = authHeader(auth);
    for (const [k, v] of Object.entries(header)) xhr.setRequestHeader(k, v);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new ApiError('Envoi interrompu. Vérifiez votre connexion.', 0));
    xhr.ontimeout = () => reject(new ApiError('Le serveur met trop de temps à répondre.', 0));
    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data as T);
      if (xhr.status === 401) handleUnauthorized(auth);
      reject(new ApiError((data as { error?: string } | null)?.error || `Erreur ${xhr.status}`, xhr.status));
    };
    xhr.send(form);
  });
}
