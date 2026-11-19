import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Loader2, Save, ShieldAlert, Trash2 } from 'lucide-react';
import { api, tokens } from '../../lib/api';
import type { Artist } from '../../lib/types';
import { useToast } from '../../context/ToastContext';
import { Avatar } from '../../components/ui/Cover';
import { Switch } from '../../components/ui/Misc';
import { Modal } from '../../components/ui/Modal';
import { VerifiedBadge } from '../../components/ui/Badges';

export function ProfileTab({ artist, onUpdated }: { artist: Artist; onUpdated: (a: Artist) => void }) {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [name, setName] = useState(artist.name);
  const [bio, setBio] = useState(artist.bio);
  const [verified, setVerified] = useState(artist.is_verified);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [removeBanner, setRemoveBanner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!avatarFile) return setAvatarPreview(null);
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  useEffect(() => {
    if (!bannerFile) return setBannerPreview(null);
    const url = URL.createObjectURL(bannerFile);
    setBannerPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [bannerFile]);

  const shownAvatar = removeAvatar ? null : avatarPreview ?? artist.avatar_url;
  const shownBanner = removeBanner ? null : bannerPreview ?? artist.banner_url;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toastError('Le nom d\'artiste ne peut pas être vide.');
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('name', name.trim());
      form.append('bio', bio);
      form.append('is_verified', String(verified));
      if (avatarFile) form.append('avatar', avatarFile);
      else if (removeAvatar) form.append('remove_avatar', 'true');
      if (bannerFile) form.append('banner', bannerFile);
      else if (removeBanner) form.append('remove_banner', 'true');

      const res = await api.put<{ artist: Artist }>('/distro/profile', form);
      onUpdated(res.artist);
      setAvatarFile(null);
      setBannerFile(null);
      setRemoveAvatar(false);
      setRemoveBanner(false);
      success('Profil mis à jour');
    } catch (err) {
      toastError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const deleteProfile = async () => {
    setDeleting(true);
    try {
      await api.del('/distro/profile');
      tokens.setArtist(null);
      success('Votre profil a été supprimé.');
      navigate('/distro');
    } catch (err) {
      toastError((err as Error).message);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <form onSubmit={save} className="space-y-6">
        <h2 className="font-display text-xl font-bold">Modifier votre profil d'artiste</h2>

        {/* Aperçu en direct : bannière + avatar */}
        <div className="overflow-hidden rounded-3xl border border-line bg-surface">
          <div className="relative aspect-[3/1] w-full bg-card">
            {shownBanner ? (
              <img src={shownBanner} alt="Aperçu de la bannière" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-accent/40 via-accent2/25 to-transparent" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
            <label className="absolute right-3 top-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-black/55 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur transition-colors hover:bg-black/75">
              <Camera size={15} /> Changer la bannière
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  setBannerFile(e.target.files?.[0] ?? null);
                  setRemoveBanner(false);
                }}
              />
            </label>
            {shownBanner && (
              <button
                type="button"
                className="absolute right-3 top-14 rounded-full bg-black/55 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur transition-colors hover:bg-danger"
                onClick={() => {
                  setBannerFile(null);
                  setRemoveBanner(true);
                }}
              >
                Retirer
              </button>
            )}
          </div>
          <div className="flex items-end gap-5 px-6 pb-5">
            <label className="group relative -mt-14 cursor-pointer">
              <Avatar src={shownAvatar} name={name || artist.name} className="h-28 w-28 ring-4 ring-surface" />
              <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Camera size={22} />
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  setAvatarFile(e.target.files?.[0] ?? null);
                  setRemoveAvatar(false);
                }}
              />
            </label>
            <div className="min-w-0 pb-1">
              <p className="flex items-center gap-1.5 font-display text-2xl font-extrabold leading-tight">
                <span className="truncate">{name || 'Votre nom'}</span>
                {verified && <VerifiedBadge size={20} />}
              </p>
              <p className="text-sm text-muted">Aperçu en direct de votre page artiste</p>
              {shownAvatar && (
                <button
                  type="button"
                  className="mt-1 text-xs font-semibold text-danger hover:underline"
                  onClick={() => {
                    setAvatarFile(null);
                    setRemoveAvatar(true);
                  }}
                >
                  Retirer la photo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Nom d'artiste</label>
            <input className="field" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Biographie</label>
            <textarea className="field min-h-[130px] resize-y" value={bio} maxLength={2000} onChange={(e) => setBio(e.target.value)} placeholder="Parlez de votre univers, de votre parcours…" />
            <p className="mt-1 text-right text-[11px] text-muted">{bio.length} / 2000</p>
          </div>
          <div className="sm:col-span-2">
            <Switch checked={verified} onChange={setVerified} label="Badge Artiste Vérifié" description="Affiche le badge vérifié à côté de votre nom partout sur SXTNN AUDIO." />
          </div>
        </div>

        <button className="btn btn-primary w-full !py-3.5" disabled={busy}>
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Mettre à jour le profil
        </button>
      </form>

      {/* Zone de danger */}
      <section className="rounded-3xl border border-danger/40 bg-danger/5 p-6">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-danger">
          <ShieldAlert size={20} /> Zone de danger
        </h3>
        <p className="mt-2 text-sm text-muted">
          La suppression de votre profil effacera définitivement votre compte, vos releases, vos morceaux ainsi que vos données associées (fichiers audio et images compris).
        </p>
        <button className="btn btn-danger mt-4 w-full" onClick={() => setDeleteOpen(true)}>
          <Trash2 size={16} /> Supprimer mon profil
        </button>
      </section>

      <Modal open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} title="Supprimer définitivement votre profil ?" size="sm">
        <div className="space-y-4 px-6 py-6">
          <p className="text-sm text-muted">
            Cette action est <strong className="text-fg">irréversible</strong>. Pour confirmer, tapez votre nom d'artiste : <strong className="text-fg">{artist.name}</strong>
          </p>
          <input className="field" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={artist.name} autoFocus />
          <div className="flex justify-end gap-3">
            <button className="btn btn-ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Annuler
            </button>
            <button className="btn btn-danger" disabled={deleting || confirmName.trim().toLowerCase() !== artist.name.toLowerCase()} onClick={deleteProfile}>
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Tout supprimer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
