import { useEffect, useMemo, useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { AlignLeft, ChevronDown, ChevronUp, FileAudio, Globe, GripVertical, ImagePlus, Loader2, Lock, Plus, Rocket, Save, Trash2, X } from 'lucide-react';
import { api, uploadForm } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import type { DistroTrack, Release, ReleaseType } from '../../lib/types';
import { Switch } from '../ui/Misc';
import { TagInput } from './TagInput';
import { CanvasPicker } from './CanvasPicker';

const FALLBACK_GENRES = ['Rage', 'Rap', 'Hip-Hop', 'Trap', 'Drill', 'R&B', 'Pop', 'Hyperpop', 'Électro', 'House', 'Techno', 'Rock', 'Indie', 'Jazz', 'Afrobeats', 'Reggaeton', 'Lo-fi', 'Autre'];
const DATE_RE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;
const TYPES: { id: ReleaseType; label: string }[] = [
  { id: 'single', label: 'Single' },
  { id: 'ep', label: 'EP' },
  { id: 'album', label: 'Album' },
];

interface TrackDraft {
  key: string;
  id?: number;
  title: string;
  file: File | null;
  existingUrl?: string;
  isrc: string;
  mains: string[];
  feats: string[];
  is_explicit: boolean;
  lyrics: string;
  showLyrics: boolean;
  canvasFile: File | null;
  existingCanvasUrl: string | null;
  removeCanvas: boolean;
}

const genKey = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

const emptyTrack = (): TrackDraft => ({
  key: genKey(),
  title: '',
  file: null,
  isrc: '',
  mains: [],
  feats: [],
  is_explicit: false,
  lyrics: '',
  showLyrics: false,
  canvasFile: null,
  existingCanvasUrl: null,
  removeCanvas: false,
});

function fileNameFromUrl(url?: string) {
  return url ? decodeURIComponent(url.split('/').pop() || '') : '';
}

function TrackEditor({
  track,
  index,
  total,
  onChange,
  onMove,
  onRemove,
  listId,
}: {
  track: TrackDraft;
  index: number;
  total: number;
  onChange: (patch: Partial<TrackDraft>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  listId: string;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={track}
      dragListener={false}
      dragControls={controls}
      className="relative list-none rounded-2xl border border-line bg-surface"
      whileDrag={{ scale: 1.01, zIndex: 10, boxShadow: '0 20px 50px -16px rgba(0,0,0,.7)' }}
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <button
          type="button"
          className="icon-btn h-8 w-7 cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={(e) => controls.start(e)}
          aria-label="Glisser pour réordonner"
          title="Glisser pour réordonner"
        >
          <GripVertical size={18} />
        </button>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent">{index + 1}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{track.title || 'Nouveau morceau'}</span>
        <button type="button" className="icon-btn h-8 w-8 hover:bg-hover disabled:opacity-30" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Monter">
          <ChevronUp size={18} />
        </button>
        <button type="button" className="icon-btn h-8 w-8 hover:bg-hover disabled:opacity-30" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Descendre">
          <ChevronDown size={18} />
        </button>
        <button type="button" className="icon-btn h-8 w-8 hover:!text-danger disabled:opacity-30" disabled={total === 1} onClick={onRemove} aria-label="Supprimer ce morceau">
          <Trash2 size={17} />
        </button>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Titre du morceau</label>
          <input className="field" value={track.title} maxLength={150} onChange={(e) => onChange({ title: e.target.value })} placeholder="Ex : Never Coming Back" />
        </div>

        <div>
          <label className="label">Fichier audio (.mp3, .wav, .flac, .ogg)</label>
          <label className="field flex cursor-pointer items-center gap-3 hover:bg-card">
            <FileAudio size={18} className={track.file || track.existingUrl ? 'text-accent' : 'text-muted'} />
            <span className="min-w-0 flex-1 truncate text-sm">
              {track.file ? track.file.name : track.existingUrl ? `Actuel : ${fileNameFromUrl(track.existingUrl)}` : 'Choisir un fichier…'}
            </span>
            <span className="shrink-0 rounded-full bg-hover px-2.5 py-1 text-xs font-semibold">{track.existingUrl || track.file ? 'Remplacer' : 'Parcourir'}</span>
            <input
              type="file"
              accept=".mp3,.wav,.flac,.ogg,audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f) onChange({ file: f });
              }}
            />
          </label>
        </div>

        <div>
          <label className="label">Code ISRC (facultatif)</label>
          <input
            className="field font-mono text-[13px] uppercase"
            value={track.isrc}
            maxLength={20}
            onChange={(e) => onChange({ isrc: e.target.value })}
            placeholder="Auto si vide : FR-SXT-26-XXXXX"
          />
        </div>

        <div>
          <label className="label">Artistes principaux additionnels</label>
          <TagInput value={track.mains} onChange={(mains) => onChange({ mains })} placeholder="Ex : Drake, Kanye West" listId={listId} />
          <p className="mt-1 text-[11px] text-muted">La sortie apparaît aussi dans leur discographie.</p>
        </div>

        <div>
          <label className="label">Featurings / Invités</label>
          <TagInput value={track.feats} onChange={(feats) => onChange({ feats })} placeholder="Ex : Travis Scott, Don Toliver" listId={listId} />
          <p className="mt-1 text-[11px] text-muted">La sortie apparaît dans leurs « Collaborations ».</p>
        </div>

        <div className="sm:col-span-2">
          <CanvasPicker
            label="Canvas du morceau (facultatif)"
            description="Boucle jouée pendant l'écoute de ce morceau. Sans canvas, celui de la sortie est utilisé s'il existe."
            file={track.canvasFile}
            existingUrl={track.existingCanvasUrl}
            removed={track.removeCanvas}
            onPick={(f) => onChange({ canvasFile: f, removeCanvas: false })}
            onRemove={() => onChange({ canvasFile: null, removeCanvas: true })}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button
            type="button"
            onClick={() => onChange({ is_explicit: !track.is_explicit })}
            aria-pressed={track.is_explicit}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              track.is_explicit ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-card text-muted hover:bg-hover'
            }`}
          >
            <span className={`grid h-4 w-4 place-items-center rounded-[3px] text-[10px] font-extrabold ${track.is_explicit ? 'bg-accent text-onaccent' : 'bg-muted/70 text-bg'}`}>E</span>
            Explicite [E]
          </button>
          <button
            type="button"
            onClick={() => onChange({ showLyrics: !track.showLyrics })}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-hover hover:text-fg"
          >
            <AlignLeft size={15} /> Paroles {track.lyrics.trim() && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
          </button>
        </div>

        {track.showLyrics && (
          <div className="sm:col-span-2">
            <label className="label">Paroles</label>
            <textarea
              className="field min-h-[160px] resize-y"
              value={track.lyrics}
              onChange={(e) => onChange({ lyrics: e.target.value })}
              placeholder="Collez ou écrivez les paroles ici…"
            />
            <p className="mt-1.5 text-xs text-muted">
              Pour les synchroniser comme sur Musixmatch : publiez d'abord la sortie, puis ouvrez Catalogue → « Paroles synchronisées ».
            </p>
          </div>
        )}
      </div>
    </Reorder.Item>
  );
}

interface ReleaseFormProps {
  mode: 'create' | 'edit';
  initial?: { release: Release; tracks: DistroTrack[] };
  onSaved: (releaseId: number) => void;
  onCancel?: () => void;
  /** true quand le formulaire est affiché dans une fenêtre modale */
  embedded?: boolean;
}

export function ReleaseForm({ mode, initial, onSaved, onCancel, embedded = false }: ReleaseFormProps) {
  const genresQuery = useApi<{ genres: string[] }>('/genres');
  const namesQuery = useApi<{ names: string[] }>('/artist-names');
  const genres = genresQuery.data?.genres ?? FALLBACK_GENRES;
  const listId = useMemo(() => `artist-names-${genKey()}`, []);

  const [title, setTitle] = useState(initial?.release.title ?? '');
  const [type, setType] = useState<ReleaseType>(initial?.release.type ?? 'single');
  const [date, setDate] = useState(initial?.release.release_date ?? '');
  const [label, setLabel] = useState(initial?.release.label && initial.release.label !== 'Indépendant' ? initial.release.label : '');
  const [primary, setPrimary] = useState(initial?.release.primary_genre ?? 'Rage');
  const [secondary, setSecondary] = useState(initial?.release.secondary_genre ?? '');
  const [isLeak, setIsLeak] = useState(initial?.release.is_leak ?? false);
  const [visibility, setVisibility] = useState<'public' | 'friends'>(initial?.release.visibility === 'friends' ? 'friends' : 'public');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [canvasFile, setCanvasFile] = useState<File | null>(null);
  const [removeCanvas, setRemoveCanvas] = useState(false);
  const [tracks, setTracks] = useState<TrackDraft[]>(() =>
    initial && initial.tracks.length
      ? initial.tracks.map((t) => ({
          key: genKey(),
          id: t.id,
          title: t.title,
          file: null,
          existingUrl: t.audio_url,
          isrc: t.isrc,
          mains: t.mains,
          feats: t.feats,
          is_explicit: t.is_explicit,
          lyrics: t.lyrics,
          showLyrics: !!t.lyrics.trim(),
          canvasFile: null,
          existingCanvasUrl: t.canvas_url ?? null,
          removeCanvas: false,
        }))
      : [emptyTrack()]
  );
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const dateInvalid = date.trim() !== '' && !DATE_RE.test(date.trim());
  const shownCover = removeCover ? null : coverPreview ?? initial?.release.cover_url ?? null;

  const patchTrack = (key: string, patch: Partial<TrackDraft>) =>
    setTracks((list) => list.map((t) => (t.key === key ? { ...t, ...patch } : t)));

  const moveTrack = (index: number, dir: -1 | 1) =>
    setTracks((list) => {
      const target = index + dir;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const validate = (): string | null => {
    if (!title.trim()) return 'Donnez un titre à votre sortie.';
    if (dateInvalid) return 'Date invalide : utilisez AAAA, AAAA-MM ou AAAA-MM-JJ.';
    if (tracks.length === 0) return 'Ajoutez au moins un morceau.';
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      if (!t.title.trim()) return `Morceau n°${i + 1} : le titre est obligatoire.`;
      if (!t.file && !t.existingUrl) return `Morceau n°${i + 1} (« ${t.title} ») : ajoutez un fichier audio.`;
    }
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSubmitting(true);
    setProgress(0);

    const payload = {
      title: title.trim(),
      type,
      release_date: date.trim(),
      label: label.trim(),
      primary_genre: primary,
      secondary_genre: secondary,
      is_leak: isLeak,
      visibility,
      remove_cover: removeCover && !coverFile,
      remove_canvas: removeCanvas && !canvasFile,
      tracks: tracks.map((t) => ({
        key: t.key,
        id: t.id,
        title: t.title.trim(),
        isrc: t.isrc.trim(),
        mains: t.mains,
        feats: t.feats,
        is_explicit: t.is_explicit,
        lyrics: t.lyrics,
        remove_canvas: t.removeCanvas && !t.canvasFile,
      })),
    };

    const form = new FormData();
    form.append('data', JSON.stringify(payload));
    if (coverFile) form.append('cover', coverFile);
    if (canvasFile) form.append('canvas', canvasFile);
    for (const t of tracks) {
      if (t.file) form.append(`audio_${t.key}`, t.file);
      if (t.canvasFile) form.append(`canvas_${t.key}`, t.canvasFile);
    }

    try {
      const res =
        mode === 'create'
          ? await uploadForm<{ id: number }>('/distro/releases', 'POST', form, setProgress)
          : await uploadForm<{ id: number }>(`/distro/releases/${initial!.release.id}`, 'PUT', form, setProgress);
      onSaved(res.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const hasUploads = coverFile !== null || canvasFile !== null || tracks.some((t) => t.file || t.canvasFile);

  return (
    <form onSubmit={submit} className="space-y-8">
      <datalist id={listId}>
        {(namesQuery.data?.names ?? []).map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      {/* ---------- Informations ---------- */}
      <section className="space-y-5">
        <h3 className="font-display text-lg font-bold">Informations de la sortie</h3>
        <div className="grid gap-5 md:grid-cols-[200px_1fr]">
          <div>
            <label className="label">Pochette</label>
            <label className="group relative block aspect-square cursor-pointer overflow-hidden rounded-2xl border border-dashed border-line bg-surface transition-colors hover:border-accent">
              {shownCover ? (
                <img src={shownCover} alt="Aperçu de la pochette" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center text-center text-xs text-muted">
                  <span>
                    <ImagePlus size={28} className="mx-auto mb-2" />
                    Ajouter une pochette
                  </span>
                </span>
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/55 text-sm font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                {shownCover ? 'Changer' : 'Choisir'}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  setCoverFile(e.target.files?.[0] ?? null);
                  setRemoveCover(false);
                }}
              />
            </label>
            {shownCover && (
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-danger hover:underline"
                onClick={() => {
                  setCoverFile(null);
                  setRemoveCover(true);
                }}
              >
                Retirer la pochette
              </button>
            )}
          </div>

          <div className="grid content-start gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Titre de la sortie</label>
              <input className="field" value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : Half Blood" required />
            </div>

            <div>
              <label className="label">Type</label>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-card p-1">
                {TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    className={`rounded-lg py-2 text-sm font-semibold transition-colors ${type === t.id ? 'bg-accent-gradient text-onaccent shadow-glow' : 'text-muted hover:text-fg'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Date de sortie</label>
              <div className="relative">
                <input
                  className={`field ${dateInvalid ? '!border-danger' : ''}`}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="AAAA, AAAA-MM ou AAAA-MM-JJ"
                  inputMode="numeric"
                />
                {!date && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-hover px-2.5 py-1 text-[11px] font-semibold hover:bg-line"
                    onClick={() => setDate(new Date().toISOString().slice(0, 10))}
                  >
                    Aujourd'hui
                  </button>
                )}
              </div>
              <p className={`mt-1 text-[11px] ${dateInvalid ? 'text-danger' : 'text-muted'}`}>
                {dateInvalid ? 'Format invalide.' : 'Ex : 2026, 2026-03 ou 2026-03-15'}
              </p>
            </div>

            <div>
              <label className="label">Label</label>
              <input className="field" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="Indépendant" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Genre principal</label>
                <select className="field" value={primary} onChange={(e) => setPrimary(e.target.value)}>
                  {genres.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Genre secondaire</label>
                <select className="field" value={secondary} onChange={(e) => setSecondary(e.target.value)}>
                  <option value="">Aucun</option>
                  {genres
                    .filter((g) => g !== primary)
                    .map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="sm:col-span-2">
              <Switch
                checked={isLeak}
                onChange={setIsLeak}
                danger
                label="Est-ce un Leak ?"
                description="Affiche un badge rouge LEAK et classe la sortie dans l'onglet « Leaks » de votre profil."
              />
            </div>

            <div className="sm:col-span-2">
              <label className="label">Qui peut écouter cette sortie ?</label>
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-card p-1.5" role="radiogroup" aria-label="Visibilité">
                {([
                  { id: 'public', icon: <Globe size={16} />, title: 'Tout le monde', text: 'Visible sur tout le site' },
                  { id: 'friends', icon: <Lock size={16} />, title: 'Amis uniquement', text: 'Démo privée, invisibles pour les autres' },
                ] as const).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={visibility === o.id}
                    onClick={() => setVisibility(o.id)}
                    className={`flex flex-col items-start gap-0.5 rounded-xl px-4 py-3 text-left transition-colors ${
                      visibility === o.id ? 'bg-accent/15 text-fg ring-1 ring-accent' : 'text-muted hover:bg-hover'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-bold">
                      {o.icon} {o.title}
                    </span>
                    <span className="text-xs text-muted">{o.text}</span>
                  </button>
                ))}
              </div>
              {visibility === 'friends' && (
                <p className="mt-2 text-xs text-muted">
                  Seuls les comptes que vous avez invités (onglet « Amis ») pourront la voir et l'écouter. Elle n'apparaît ni à l'accueil, ni dans la recherche pour les autres, et ne passe jamais « à la une ».
                </p>
              )}
            </div>
          </div>
        </div>

        <CanvasPicker
          label="Canvas de la sortie (facultatif)"
          description="Boucle jouée pendant l'écoute de tous les morceaux de cette sortie qui n'ont pas leur propre canvas."
          file={canvasFile}
          existingUrl={initial?.release.canvas_url ?? null}
          removed={removeCanvas}
          onPick={(f) => {
            setCanvasFile(f);
            setRemoveCanvas(false);
          }}
          onRemove={() => {
            setCanvasFile(null);
            setRemoveCanvas(true);
          }}
        />
      </section>

      {/* ---------- Tracklist ---------- */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-bold">Tracklist</h3>
            <p className="text-sm text-muted">Glissez les morceaux (poignée à gauche) ou utilisez les flèches pour les ordonner.</p>
          </div>
          <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-muted">
            {tracks.length} morceau{tracks.length > 1 ? 'x' : ''}
          </span>
        </div>

        <Reorder.Group axis="y" values={tracks} onReorder={setTracks} className="space-y-3">
          {tracks.map((t, i) => (
            <TrackEditor
              key={t.key}
              track={t}
              index={i}
              total={tracks.length}
              listId={listId}
              onChange={(patch) => patchTrack(t.key, patch)}
              onMove={(dir) => moveTrack(i, dir)}
              onRemove={() => setTracks((list) => list.filter((x) => x.key !== t.key))}
            />
          ))}
        </Reorder.Group>

        <button
          type="button"
          onClick={() => setTracks((list) => [...list, emptyTrack()])}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-4 text-sm font-semibold text-muted transition-colors hover:border-accent hover:bg-accent/5 hover:text-accent"
        >
          <Plus size={18} /> Ajouter un morceau
        </button>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          <X size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ---------- Actions ---------- */}
      <div
        className={`sticky z-10 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-line bg-surface/90 p-3 backdrop-blur-xl ${
          embedded ? 'bottom-0' : 'bottom-[calc(var(--player-h)+var(--mnav-h)+0.75rem)]'
        }`}
      >
        {submitting && hasUploads && (
          <div className="mr-auto min-w-[160px] flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-hover">
              <div className="h-full rounded-full bg-accent-gradient transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">{progress < 100 ? `Envoi des fichiers… ${progress} %` : 'Analyse des fichiers audio…'}</p>
          </div>
        )}
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
            Annuler
          </button>
        )}
        <button className="btn btn-primary !px-7 !py-3.5" disabled={submitting}>
          {submitting ? <Loader2 size={17} className="animate-spin" /> : mode === 'create' ? <Rocket size={17} /> : <Save size={17} />}
          {mode === 'create' ? 'Publier la sortie' : 'Enregistrer les modifications'}
        </button>
      </div>
    </form>
  );
}

// Utilisé par le catalogue pour charger les données d'édition d'une sortie
export async function fetchEditableRelease(id: number) {
  return api.get<{ release: Release; tracks: DistroTrack[] }>(`/distro/releases/${id}`);
}
