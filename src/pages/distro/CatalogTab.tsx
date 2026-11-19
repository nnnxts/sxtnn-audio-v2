import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Archive, Download, Headphones, Loader2, Music, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { api, tokens, uploadForm } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import type { DistroTrack, Release } from '../../lib/types';
import { formatCount, formatReleaseDate, typeLabel } from '../../lib/format';
import { useToast } from '../../context/ToastContext';
import { Cover } from '../../components/ui/Cover';
import { LeakBadge } from '../../components/ui/Badges';
import { EmptyState, ErrorState, RowsSkeleton, Skeleton } from '../../components/ui/Misc';
import { Modal } from '../../components/ui/Modal';
import { ReleaseForm, fetchEditableRelease } from '../../components/distro/ReleaseForm';

interface AdminStatus {
  key_required: boolean;
  restore_available: boolean;
}

function BackupCard({ status }: { status: AdminStatus | null }) {
  const { error: toastError, success } = useToast();
  const [busy, setBusy] = useState(false);
  const [adminKey, setAdminKey] = useState('');

  const download = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ url: string }>('/distro/backup-link', { admin_key: adminKey });
      // Le serveur répond avec Content-Disposition: attachment : le navigateur télécharge sans quitter la page
      const a = document.createElement('a');
      a.href = res.url;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      success('Préparation de la sauvegarde… le téléchargement va démarrer.');
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      window.setTimeout(() => setBusy(false), 2500);
    }
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent">
            <Archive size={22} />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold">Sauvegarde totale du site</h3>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Archive à la volée la base de données (<code className="rounded bg-card px-1 text-xs">database.sqlite</code>) et tout le dossier{' '}
              <code className="rounded bg-card px-1 text-xs">uploads/</code> (audio, pochettes, canvas, avatars, bannières). Idéal pour restaurer ou migrer le site à 100 %.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {status?.key_required && (
            <input
              type="password"
              className="field !py-2.5 sm:w-64"
              placeholder="Clé admin"
              value={adminKey}
              autoComplete="off"
              onChange={(e) => setAdminKey(e.target.value)}
            />
          )}
          <button className="btn btn-primary !py-3.5" onClick={download} disabled={busy || (!!status?.key_required && !adminKey)}>
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
            Télécharger un Backup Complet (.zip)
          </button>
        </div>
      </div>
    </section>
  );
}

function RestoreCard({ status }: { status: AdminStatus | null }) {
  const { error: toastError, success } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [adminKey, setAdminKey] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const available = status?.restore_available ?? false;

  const restore = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const form = new FormData();
      form.append('admin_key', adminKey); // à mettre AVANT le fichier : le serveur la vérifie en premier
      form.append('backup', file);
      const res = await uploadForm<{ ok: boolean; summary: { artists: number; releases: number; tracks: number } }>('/distro/restore', 'POST', form, setProgress);
      success(`Restauration terminée : ${res.summary.artists} artiste(s), ${res.summary.releases} sortie(s), ${res.summary.tracks} morceau(x).`);
      // Les numéros de comptes peuvent avoir changé : on repart d'une session propre
      tokens.setArtist(null);
      tokens.setUser(null);
      window.setTimeout(() => {
        window.location.href = '/distro';
      }, 1800);
    } catch (e) {
      setError((e as Error).message);
      setConfirmOpen(false);
      setBusy(false);
    }
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6">
      <div className="relative flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-danger/15 text-danger">
            <RotateCcw size={22} />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold">Restaurer un backup</h3>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Choisissez un zip créé avec le bouton ci-dessus : le site retrouve exactement ses comptes, sorties, sons, pochettes et canvas.{' '}
              <strong className="text-fg">Tout le contenu actuel du site est remplacé.</strong>
            </p>
          </div>
        </div>

        {!status ? (
          <Skeleton className="h-12 w-full" />
        ) : !available ? (
          <p className="rounded-2xl border border-line bg-card px-4 py-3 text-sm text-muted">
            La restauration est désactivée en ligne tant que la variable <code className="rounded bg-surface px-1 text-xs">ADMIN_KEY</code> n'est pas définie dans Railway (onglet Variables). Elle protège le site : sans elle, n'importe quel artiste pourrait tout écraser.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="field flex flex-1 cursor-pointer items-center gap-3 hover:bg-card">
                <Archive size={18} className={file ? 'text-accent' : 'text-muted'} />
                <span className="min-w-0 flex-1 truncate text-sm">{file ? `${file.name} (${(file.size / 1048576).toFixed(1)} Mo)` : 'Choisir un backup (.zip)…'}</span>
                <span className="shrink-0 rounded-full bg-hover px-2.5 py-1 text-xs font-semibold">{file ? 'Changer' : 'Parcourir'}</span>
                <input
                  type="file"
                  accept=".zip,application/zip"
                  className="hidden"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setError(null);
                  }}
                />
              </label>
              {status?.key_required && (
                <input type="password" className="field sm:w-64" placeholder="Clé admin" value={adminKey} autoComplete="off" onChange={(e) => setAdminKey(e.target.value)} />
              )}
              <button
                className="btn btn-danger !py-3.5"
                disabled={!file || busy || (!!status?.key_required && !adminKey)}
                onClick={() => {
                  setConfirmText('');
                  setConfirmOpen(true);
                }}
              >
                <RotateCcw size={16} /> Restaurer
              </button>
            </div>
            {error && (
              <p className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </div>

      <Modal open={confirmOpen} onClose={() => !busy && setConfirmOpen(false)} title="Remplacer tout le contenu du site ?" size="sm">
        <div className="space-y-4 px-6 py-6">
          <p className="text-sm text-muted">
            Les comptes, sorties, morceaux et images <strong className="text-fg">actuels seront remplacés</strong> par ceux du backup. Conseil : téléchargez d'abord un backup de l'état actuel.
          </p>
          <p className="text-sm text-muted">
            Pour confirmer, tapez <strong className="text-fg">RESTAURER</strong> :
          </p>
          <input className="field" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="RESTAURER" autoFocus disabled={busy} />
          {busy && (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-hover">
                <div className="h-full rounded-full bg-accent-gradient transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">{progress < 100 ? `Envoi du backup… ${progress} %` : 'Restauration en cours, ne fermez pas la page…'}</p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button className="btn btn-ghost" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Annuler
            </button>
            <button className="btn btn-danger" disabled={busy || confirmText.trim().toUpperCase() !== 'RESTAURER'} onClick={restore}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />} Restaurer maintenant
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

export function CatalogTab({ refreshKey }: { refreshKey: number }) {
  const { data, loading, error, reload } = useApi<{ releases: Release[] }>('/distro/releases', [refreshKey]);
  const { success, error: toastError } = useToast();
  const adminStatus = useApi<AdminStatus>('/distro/admin-status');
  const [editing, setEditing] = useState<{ release: Release; tracks: DistroTrack[] } | null>(null);
  const [loadingEdit, setLoadingEdit] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<Release | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openEdit = async (release: Release) => {
    setLoadingEdit(release.id);
    try {
      setEditing(await fetchEditableRelease(release.id));
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      setLoadingEdit(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/distro/releases/${toDelete.id}`);
      success(`« ${toDelete.title} » supprimée`);
      setToDelete(null);
      reload();
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const releases = data?.releases ?? [];

  return (
    <div className="space-y-8">
      <BackupCard status={adminStatus.data} />
      <RestoreCard status={adminStatus.data} />

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-xl font-bold">Vos sorties publiées</h2>
          <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-muted">
            {releases.length} sortie{releases.length > 1 ? 's' : ''}
          </span>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <RowsSkeleton count={4} />
        ) : releases.length === 0 ? (
          <EmptyState icon={<Music size={26} />} title="Aucune sortie pour l'instant" text="Utilisez l'onglet « Publier une sortie » pour mettre en ligne votre première musique." />
        ) : (
          <div className="space-y-2.5">
            {releases.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.03 }}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-3 transition-colors hover:bg-card/60"
              >
                <Link to={`/release/${r.id}`} target="_blank" rel="noreferrer" className="shrink-0">
                  <Cover src={r.cover_url} alt={r.title} className="h-16 w-16" flat />
                </Link>
                <div className="min-w-0 flex-1 basis-48">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link to={`/release/${r.id}`} target="_blank" rel="noreferrer" className="truncate font-semibold hover:underline">
                      {r.title}
                    </Link>
                    {r.is_leak && <LeakBadge />}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {typeLabel(r.type)} · {formatReleaseDate(r.release_date)} · {r.track_count} morceau{r.track_count > 1 ? 'x' : ''}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                    <Headphones size={12} /> {formatCount(r.play_count)} écoute{r.play_count > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button className="btn btn-ghost !px-4 !py-2.5" onClick={() => openEdit(r)} disabled={loadingEdit === r.id}>
                    {loadingEdit === r.id ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />} Modifier
                  </button>
                  <button className="btn btn-danger !px-4 !py-2.5" onClick={() => setToDelete(r)}>
                    <Trash2 size={15} /> Supprimer
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Modale d'édition complète */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Modifier « ${editing.release.title} »` : ''} size="xl">
        {editing && (
          <div className="px-5 py-6 sm:px-8">
            <ReleaseForm
              key={editing.release.id}
              mode="edit"
              embedded
              initial={editing}
              onCancel={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                success('Sortie mise à jour');
                reload();
              }}
            />
          </div>
        )}
      </Modal>

      {/* Confirmation de suppression */}
      <Modal open={!!toDelete} onClose={() => !deleting && setToDelete(null)} title="Supprimer cette sortie ?" size="sm">
        <div className="space-y-4 px-6 py-6">
          <p className="text-sm text-muted">
            « <strong className="text-fg">{toDelete?.title}</strong> » et ses {toDelete?.track_count} morceau(x) seront supprimés définitivement, ainsi que les fichiers audio et la pochette devenus inutiles sur le serveur.
          </p>
          <div className="flex justify-end gap-3">
            <button className="btn btn-ghost" onClick={() => setToDelete(null)} disabled={deleting}>
              Annuler
            </button>
            <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Supprimer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
