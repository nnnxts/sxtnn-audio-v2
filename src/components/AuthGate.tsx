import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { EmptyState, RowsSkeleton } from './ui/Misc';

/** Affiche son contenu uniquement pour un compte connecté, sinon invite à se connecter. */
export function AuthGate({ reason, children }: { reason: string; children: ReactNode }) {
  const { user, loading, openAuth } = useAuth();
  if (loading) return <RowsSkeleton count={5} />;
  if (!user) {
    return (
      <EmptyState
        icon={<Lock size={26} />}
        title="Connexion requise"
        text={reason}
        action={
          <button className="btn btn-primary" onClick={() => openAuth(reason)}>
            Se connecter / S'inscrire
          </button>
        }
      />
    );
  }
  return <>{children}</>;
}
