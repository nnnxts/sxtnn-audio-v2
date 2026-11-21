import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, KeyRound, Loader2, Mic } from 'lucide-react';
import { accessCode, api, tokens } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import type { Artist } from '../../lib/types';
import { useToast } from '../../context/ToastContext';
import { Avatar } from '../../components/ui/Cover';
import { useForcedDarkTheme } from './useDistro';

/** Barres d'égaliseur décoratives en fond */
function Waveform() {
  const bars = Array.from({ length: 72 });
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[46vh] items-end justify-center gap-[5px] overflow-hidden px-2 opacity-60" aria-hidden>
      {bars.map((_, i) => {
        const h = 22 + Math.abs(Math.sin(i * 0.55) * 55) + ((i * 37) % 23);
        return (
          <span
            key={i}
            className="w-[6px] shrink-0 origin-bottom rounded-t-full bg-gradient-to-t from-accent/70 via-accent2/50 to-transparent"
            style={{
              height: `${h}%`,
              animation: `eq ${1.6 + ((i * 13) % 9) / 10}s ease-in-out ${(i % 12) * 0.11}s infinite`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function DistroLogin() {
  useForcedDarkTheme();
  useDocumentTitle('SXTNN DISTRO');
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [name, setName] = useState('');
  // Étape 1 : code d'accès (si le serveur en exige un) — étape 2 : nom d'artiste
  const [needCode, setNeedCode] = useState<boolean | null>(null);
  const [code, setCode] = useState('');
  const [codeOk, setCodeOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<Artist | null>(null);

  // Session artiste déjà ouverte ?
  useEffect(() => {
    if (!tokens.getArtist()) return;
    let alive = true;
    api
      .get<{ artist: Artist }>('/distro/me')
      .then((res) => alive && setExisting(res.artist))
      .catch(() => tokens.setArtist(null));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .get<{ code_required: boolean }>('/distro/access')
      .then((res) => {
        if (!alive) return;
        setNeedCode(res.code_required);
        if (!res.code_required) setCodeOk(true);
      })
      .catch(() => alive && setNeedCode(false));
    return () => {
      alive = false;
    };
  }, []);

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Entrez le code d\'accès.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.post('/distro/check-code', { code: code.trim() });
      accessCode.set(code.trim());
      setCodeOk(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = name.trim();
    if (!value) {
      setError('Entrez votre nom d\'artiste.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<{ token: string; artist: Artist; created: boolean }>('/distro/login', {
        name: value,
        code: accessCode.get(),
      });
      tokens.setArtist(res.token);
      success(res.created ? `Profil artiste « ${res.artist.name} » créé !` : `Bienvenue, ${res.artist.name} !`);
      navigate('/distro/dashboard');
    } catch (err) {
      setError((err as Error).message);
      toastError((err as Error).message);
      if ((err as { status?: number }).status === 403) {
        accessCode.set(null);
        setCodeOk(false);
        setCode('');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-bg text-fg">
      <div className="pointer-events-none absolute -left-40 -top-40 -z-10 h-[520px] w-[520px] rounded-full bg-accent/25 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 top-1/3 -z-10 h-[460px] w-[460px] rounded-full bg-accent2/20 blur-[120px]" />
      <Waveform />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16">
        <Link to="/" className="mb-8 inline-flex w-fit items-center gap-2 text-sm font-semibold text-muted transition-colors hover:text-fg">
          <ArrowLeft size={16} /> Retour à SXTNN AUDIO
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="glass rounded-[28px] border border-line p-8 shadow-soft"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-gradient text-onaccent shadow-glow">
              <Mic size={22} />
            </span>
            <div>
              <h1 className="font-display text-2xl font-extrabold leading-none tracking-tight">
                SXTNN <span className="text-gradient">DISTRO</span>
              </h1>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted">Portail de distribution</p>
            </div>
          </div>

          <p className="mt-6 text-[15px] leading-relaxed text-fg/80">
            Publiez vos sorties, gérez votre catalogue et votre profil.{' '}
            {needCode ? 'Entrez le code d\'accès, puis votre nom d\'artiste.' : 'Un seul champ suffit : votre nom d\'artiste.'}
          </p>

          {existing && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-3">
              <Avatar src={existing.avatar_url} name={existing.name} className="h-12 w-12" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">Session ouverte</p>
                <p className="truncate font-semibold">{existing.name}</p>
              </div>
              <button className="btn btn-primary !px-4 !py-2.5" onClick={() => navigate('/distro/dashboard')}>
                Continuer <ArrowRight size={15} />
              </button>
            </motion.div>
          )}

          {needCode === null ? (
            <div className="mt-8 grid place-items-center py-6 text-muted">
              <Loader2 className="animate-spin" size={22} />
            </div>
          ) : !codeOk ? (
            <form onSubmit={submitCode} className="mt-6 space-y-4">
              <div>
                <label htmlFor="access-code" className="label">
                  Code d'accès artiste
                </label>
                <div className="relative">
                  <KeyRound size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    id="access-code"
                    type="password"
                    className="field !py-3.5 !pl-11 text-base"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Votre code"
                    autoFocus
                    autoComplete="current-password"
                  />
                </div>
                <p className="mt-2 text-xs text-muted">Le même code que pour les sauvegardes. Il évite que n'importe qui crée un profil artiste.</p>
              </div>
              {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
              <button className="btn btn-primary w-full !py-3.5 text-[15px]" disabled={busy || !code.trim()}>
                {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                Continuer
              </button>
            </form>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="artist-name" className="label">
                  Entrez votre nom d'artiste
                </label>
                <input
                  id="artist-name"
                  className="field !py-3.5 text-base"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex : sxtnn"
                  maxLength={60}
                  autoFocus
                  autoComplete="off"
                />
                <p className="mt-2 text-xs text-muted">Nouveau nom ? Votre profil artiste est créé automatiquement.</p>
              </div>
              {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
              <button className="btn btn-primary w-full !py-3.5 text-[15px]" disabled={busy || !name.trim()}>
                {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                Accéder au studio
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
