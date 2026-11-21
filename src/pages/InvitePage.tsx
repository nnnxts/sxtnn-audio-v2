import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Loader2, Lock, LogIn, UserPlus } from 'lucide-react';
import { api } from '../lib/api';
import { useDocumentTitle } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Avatar } from '../components/ui/Cover';
import { VerifiedBadge } from '../components/ui/Badges';

interface Preview {
  artist: { id: number; name: string; avatar_url: string | null; is_verified: boolean };
}

/** Page ouverte depuis un lien d'invitation : /invite/<code> */
export default function InvitePage() {
  useDocumentTitle('Invitation');
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, openAuth } = useAuth();
  const { success, error: toastError } = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<Preview>(`/invites/${encodeURIComponent(token)}`)
      .then((res) => alive && setPreview(res))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [token]);

  const accept = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ artist: { id: number; name: string }; already: boolean }>(`/invites/${encodeURIComponent(token)}/accept`);
      setDone(res.artist);
      success(res.already ? 'Vous êtes déjà ami(e) avec cet artiste.' : `Vous êtes maintenant ami(e) avec ${res.artist.name} !`);
    } catch (e) {
      toastError((e as Error).message);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass w-full rounded-[28px] border border-line p-8 text-center shadow-soft">
        {error && !done ? (
          <>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-danger/15 text-danger">
              <Lock size={24} />
            </span>
            <h1 className="mt-5 font-display text-2xl font-extrabold">Invitation indisponible</h1>
            <p className="mt-2 text-sm text-muted">{error}</p>
            <Link to="/" className="btn btn-primary mt-6">
              Retour à l'accueil
            </Link>
          </>
        ) : !preview ? (
          <Loader2 className="mx-auto animate-spin text-muted" />
        ) : done ? (
          <>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-gradient text-onaccent shadow-glow">
              <Check size={26} />
            </span>
            <h1 className="mt-5 font-display text-2xl font-extrabold">C'est fait !</h1>
            <p className="mt-2 text-sm text-muted">Vous pouvez maintenant écouter les sorties privées de {done.name}.</p>
            <button className="btn btn-primary mt-6" onClick={() => navigate(`/artist/${done.id}`)}>
              Voir la page de {done.name}
            </button>
          </>
        ) : (
          <>
            <Avatar src={preview.artist.avatar_url} name={preview.artist.name} className="mx-auto h-24 w-24" />
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-muted">Invitation privée</p>
            <h1 className="mt-1 flex items-center justify-center gap-2 font-display text-2xl font-extrabold">
              {preview.artist.name} {preview.artist.is_verified && <VerifiedBadge size={20} />}
            </h1>
            <p className="mt-3 text-sm text-muted">
              vous invite à rejoindre ses amis sur SXTNN AUDIO pour écouter ses sorties privées. Votre compte reste anonyme : personne ne voit la liste de ses amis.
            </p>
            {authLoading ? (
              <Loader2 className="mx-auto mt-6 animate-spin text-muted" />
            ) : user ? (
              <button className="btn btn-primary mt-6 w-full !py-3.5" onClick={accept} disabled={busy}>
                {busy ? <Loader2 size={17} className="animate-spin" /> : <UserPlus size={17} />}
                Accepter l'invitation
              </button>
            ) : (
              <>
                <button className="btn btn-primary mt-6 w-full !py-3.5" onClick={() => openAuth('Connectez-vous ou créez un compte, puis revenez accepter l\'invitation.')}>
                  <LogIn size={17} /> Se connecter / Créer un compte
                </button>
                <p className="mt-3 text-xs text-muted">Une fois connecté(e), cette page vous proposera d'accepter l'invitation.</p>
              </>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
