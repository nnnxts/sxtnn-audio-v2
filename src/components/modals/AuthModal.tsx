import { useEffect, useState } from 'react';
import { Camera, Loader2, Lock, Mail, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Avatar } from '../ui/Cover';
import { Modal } from '../ui/Modal';

type Mode = 'login' | 'register';

export function AuthModal() {
  const { authOpen, authReason, closeAuth, login, register } = useAuth();
  const { success } = useToast();
  const [mode, setMode] = useState<Mode>('login');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!avatar) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatar);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatar]);

  useEffect(() => {
    if (authOpen) setError(null);
  }, [authOpen, mode]);

  const reset = () => {
    setPassword('');
    setAvatar(null);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(identifier.trim(), password);
        success('Content de vous revoir !');
      } else {
        const form = new FormData();
        form.append('username', username.trim());
        form.append('email', email.trim());
        form.append('password', password);
        if (avatar) form.append('avatar', avatar);
        await register(form);
        success('Bienvenue sur SXTNN AUDIO !');
      }
      reset();
      closeAuth();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={authOpen} onClose={closeAuth} size="sm" bare>
      <div className="relative overflow-hidden px-7 pb-8 pt-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-accent/30 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 top-32 h-40 w-40 rounded-full bg-accent2/20 blur-3xl" />

        <div className="relative">
          <h2 className="font-display text-2xl font-extrabold tracking-tight">
            {mode === 'login' ? 'Content de vous revoir' : 'Créer votre compte'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {authReason ?? 'Débloquez vos coups de cœur, vos playlists, vos abonnements et des recommandations personnalisées.'}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-card p-1">
            {(['login', 'register'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-full py-2 text-sm font-semibold transition-colors ${
                  mode === m ? 'bg-accent-gradient text-onaccent shadow-glow' : 'text-muted hover:text-fg'
                }`}
              >
                {m === 'login' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <>
                <div className="flex items-center gap-4">
                  <label className="group relative cursor-pointer">
                    <Avatar src={preview} name={username || 'Vous'} className="h-16 w-16" />
                    <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <Camera size={20} />
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} />
                  </label>
                  <p className="text-xs text-muted">Photo de profil (facultatif)</p>
                </div>
                <div>
                  <label className="label">Pseudo</label>
                  <div className="relative">
                    <UserIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      className="field !pl-10"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      minLength={2}
                      maxLength={30}
                      placeholder="Votre pseudo"
                      autoComplete="username"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="label">{mode === 'login' ? 'E-mail ou pseudo' : 'E-mail'}</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  className="field !pl-10"
                  type={mode === 'login' ? 'text' : 'email'}
                  value={mode === 'login' ? identifier : email}
                  onChange={(e) => (mode === 'login' ? setIdentifier(e.target.value) : setEmail(e.target.value))}
                  required
                  placeholder={mode === 'login' ? 'vous@exemple.com' : 'vous@exemple.com'}
                  autoComplete={mode === 'login' ? 'username' : 'email'}
                />
              </div>
            </div>

            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  className="field !pl-10"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="6 caractères minimum"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>
            </div>

            {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

            <button className="btn btn-primary w-full !py-3.5" disabled={busy}>
              {busy && <Loader2 size={16} className="animate-spin" />}
              {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-muted">
            Tout le catalogue reste écoutable sans compte.{' '}
            <button type="button" onClick={closeAuth} className="font-semibold text-fg underline-offset-2 hover:underline">
              Continuer sans me connecter
            </button>
          </p>
        </div>
      </div>
    </Modal>
  );
}
