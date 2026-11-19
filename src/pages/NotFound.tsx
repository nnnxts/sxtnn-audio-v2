import { Link } from 'react-router-dom';
import { Disc3 } from 'lucide-react';
import { useDocumentTitle } from '../lib/hooks';

export default function NotFound() {
  useDocumentTitle('Page introuvable');
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <Disc3 size={84} strokeWidth={1.2} className="mx-auto animate-[spin_8s_linear_infinite] text-accent" />
        <h1 className="mt-6 font-display text-6xl font-extrabold tracking-tight">404</h1>
        <p className="mt-2 text-muted">Cette page n'existe pas (ou plus).</p>
        <Link to="/" className="btn btn-primary mt-6">
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
