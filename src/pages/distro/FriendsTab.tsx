import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Link2, Loader2, Lock, Trash2, UserMinus, UserPlus, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import type { DistroFriend, DistroInvite } from '../../lib/types';
import { useToast } from '../../context/ToastContext';
import { Avatar } from '../../components/ui/Cover';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Misc';

interface FriendsData {
  friends: DistroFriend[];
  invites: DistroInvite[];
  invite_days: number;
}

const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function formatDay(value: string) {
  const d = new Date(value.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

export function FriendsTab() {
  const { data, loading, error, reload } = useApi<FriendsData>('/distro/friends');
  const { success, error: toastError } = useToast();
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | number | null>(null);

  const copy = async (token: string) => {
    const ok = await copyText(inviteUrl(token));
    if (ok) {
      setCopied(token);
      success('Lien copié ! Envoyez-le à votre ami.');
      window.setTimeout(() => setCopied((c) => (c === token ? null : c)), 2200);
    } else {
      toastError('Impossible de copier automatiquement : sélectionnez le lien et copiez-le.');
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      const res = await api.post<{ invite: DistroInvite }>('/distro/friends/invites');
      reload();
      await copy(res.invite.token);
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (token: string) => {
    setBusyId(token);
    try {
      await api.del(`/distro/friends/invites/${encodeURIComponent(token)}`);
      reload();
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const removeFriend = async (f: DistroFriend) => {
    if (!window.confirm(`Retirer « ${f.username} » de vos amis ? Il ne verra plus vos sorties privées.`)) return;
    setBusyId(f.id);
    try {
      await api.del(`/distro/friends/${f.id}`);
      reload();
      success(`${f.username} retiré`);
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const friends = data?.friends ?? [];
  const invites = data?.invites ?? [];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent">
              <Lock size={22} />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold">Amis & sorties privées</h3>
              <p className="mt-1 max-w-xl text-sm text-muted">
                Créez un lien d'invitation et envoyez-le à un proche, à votre manager… Une fois le lien ouvert (avec son compte SXTNN AUDIO), il peut écouter vos sorties réglées sur « Amis uniquement ».
                Personne d'autre ne les voit, et la liste de vos amis n'apparaît nulle part sur le site : vous seul la voyez ici.
              </p>
            </div>
          </div>
          <button className="btn btn-primary shrink-0 !py-3.5" onClick={create} disabled={creating}>
            {creating ? <Loader2 size={17} className="animate-spin" /> : <UserPlus size={17} />}
            Créer un lien d'invitation
          </button>
        </div>
      </section>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full !rounded-2xl" />
          <Skeleton className="h-20 w-full !rounded-2xl" />
        </div>
      ) : (
        <>
          <section>
            <div className="mb-4 flex items-end justify-between">
              <h2 className="font-display text-xl font-bold">Liens d'invitation actifs</h2>
              <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-muted">{invites.length}</span>
            </div>
            {invites.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-5 py-6 text-sm text-muted">
                Aucun lien en attente. Chaque lien est à usage unique et reste valable {data?.invite_days ?? 7} jours.
              </p>
            ) : (
              <div className="space-y-2.5">
                {invites.map((inv) => (
                  <motion.div key={inv.token} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
                      <Link2 size={17} />
                    </span>
                    <div className="min-w-0 flex-1 basis-56">
                      <input readOnly className="field !py-2.5 text-xs" value={inviteUrl(inv.token)} onFocus={(e) => e.currentTarget.select()} />
                      <p className="mt-1 text-xs text-muted">Valable jusqu'au {formatDay(inv.expires_at)} · usage unique</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button className="btn btn-ghost !px-4 !py-2.5" onClick={() => copy(inv.token)}>
                        {copied === inv.token ? <Check size={15} /> : <Copy size={15} />} Copier
                      </button>
                      <button className="btn btn-danger !px-4 !py-2.5" onClick={() => revoke(inv.token)} disabled={busyId === inv.token}>
                        {busyId === inv.token ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Révoquer
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between">
              <h2 className="font-display text-xl font-bold">Vos amis</h2>
              <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-muted">{friends.length}</span>
            </div>
            {friends.length === 0 ? (
              <EmptyState icon={<Users size={26} />} title="Pas encore d'amis" text="Créez un lien d'invitation et envoyez-le : dès qu'il est accepté, la personne apparaît ici." />
            ) : (
              <div className="space-y-2.5">
                {friends.map((f) => (
                  <motion.div key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                    <Avatar src={f.avatar_url} name={f.username} className="h-11 w-11" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{f.username}</p>
                      <p className="text-xs text-muted">Ami depuis le {formatDay(f.created_at)}</p>
                    </div>
                    <button className="btn btn-ghost !px-4 !py-2.5" onClick={() => removeFriend(f)} disabled={busyId === f.id}>
                      {busyId === f.id ? <Loader2 size={15} className="animate-spin" /> : <UserMinus size={15} />} Retirer
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
