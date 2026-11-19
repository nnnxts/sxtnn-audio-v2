import { useEffect, useState } from 'react';
import { Film, Loader2, Upload } from 'lucide-react';
import { checkCanvasFile } from '../../lib/canvas';

interface CanvasPickerProps {
  label: string;
  description: string;
  file: File | null;
  existingUrl: string | null;
  removed: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}

/** Sélecteur de canvas (vidéo verticale de 8 s max) avec aperçu en boucle. */
export function CanvasPicker({ label, description, file, existingUrl, removed, onPick, onRemove }: CanvasPickerProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!file) {
      setFileUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shown = removed ? null : fileUrl ?? existingUrl;

  const choose = async (picked: File | null) => {
    if (!picked) return;
    setChecking(true);
    setError(null);
    const problem = await checkCanvasFile(picked);
    setChecking(false);
    if (problem) {
      setError(problem);
      return;
    }
    onPick(picked);
  };

  return (
    <div className="flex items-start gap-4 rounded-2xl border border-line bg-card/50 p-3">
      <div className="relative aspect-[9/16] w-20 shrink-0 overflow-hidden rounded-xl bg-surface ring-1 ring-line">
        {shown ? (
          <video key={shown} src={shown} muted loop autoPlay playsInline preload="metadata" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted">
            <Film size={22} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
        <p className="mt-1 text-[11px] text-muted">Vidéo verticale (9:16) · MP4 ou WebM · 8 s maximum · 15 Mo maximum · sans son</p>
        {error && (
          <p className="mt-1.5 text-xs font-medium text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap gap-2">
          <label className="btn btn-ghost cursor-pointer !px-3.5 !py-2 text-xs">
            {checking ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {shown ? 'Remplacer' : 'Ajouter un canvas'}
            <input
              type="file"
              accept="video/mp4,video/webm,.mp4,.m4v,.webm"
              className="hidden"
              disabled={checking}
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                e.target.value = '';
                void choose(picked);
              }}
            />
          </label>
          {shown && (
            <button
              type="button"
              className="btn btn-danger !px-3.5 !py-2 text-xs"
              onClick={() => {
                setError(null);
                onRemove();
              }}
            >
              Retirer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
