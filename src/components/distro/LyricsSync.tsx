import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlignLeft, Check, Loader2, Mic2, RotateCcw, Save, Timer, Trash2, Undo2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { DistroTrack, Release } from '../../lib/types';
import { buildLrc, formatStamp, parseLyrics } from '../../lib/lrc';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../ui/Modal';
import { fetchEditableRelease } from './ReleaseForm';

interface Row {
  text: string;
  t: number | null;
}

function toRows(lyrics: string): Row[] {
  const parsed = parseLyrics(lyrics);
  if (parsed.synced) return parsed.lines.map((l) => ({ text: l.text, t: l.t }));
  return parsed.plain
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => ({ text, t: null }));
}

/** Éditeur de synchronisation : on écoute le morceau et on appuie sur « TOP » au début de chaque ligne. */
function Editor({ track, onSaved }: { track: DistroTrack; onSaved: () => void }) {
  const { success, error: toastError } = useToast();
  const audioRef = useRef<HTMLAudioElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<Row[]>(() => toRows(track.lyrics));
  const [editText, setEditText] = useState(false);
  const [rawText, setRawText] = useState(() => toRows(track.lyrics).map((r) => r.text).join('\n'));
  // Les humains appuient un peu en retard : on retire ce délai de réaction à chaque top
  const [latency, setLatency] = useState(0.25);
  const [saving, setSaving] = useState(false);

  const cursor = useMemo(() => {
    const i = rows.findIndex((r) => r.t === null);
    return i === -1 ? rows.length : i;
  }, [rows]);
  const timed = rows.filter((r) => r.t !== null).length;
  const complete = rows.length > 0 && timed === rows.length;

  const tap = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setRows((prev) => {
      const i = prev.findIndex((r) => r.t === null);
      if (i === -1) return prev;
      const t = Math.max(0, Math.round((audio.currentTime - latency) * 100) / 100);
      return prev.map((r, k) => (k === i ? { ...r, t } : r));
    });
  }, [latency]);

  // Barre d'espace = TOP (sauf quand on écrit dans un champ)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        tap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tap]);

  // La ligne en attente reste visible
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-row="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [cursor]);

  const undo = () => {
    const i = cursor - 1;
    if (i < 0) return;
    setRows((prev) => prev.map((r, k) => (k === i ? { ...r, t: null } : r)));
    const audio = audioRef.current;
    const prevT = rows[i]?.t;
    if (audio && prevT !== null && prevT !== undefined) audio.currentTime = Math.max(0, prevT - 1.5);
  };

  const applyText = () => {
    const next = rawText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((text, i) => ({ text, t: rows[i] && rows[i].text === text ? rows[i].t : null }));
    setRows(next);
    setEditText(false);
  };

  const setTime = (i: number, value: string) => {
    const m = /^(\d{1,3}):(\d{1,2}(?:\.\d{1,3})?)$/.exec(value.trim());
    if (!m) return;
    const t = Math.round((Number(m[1]) * 60 + Number(m[2])) * 100) / 100;
    setRows((prev) => prev.map((r, k) => (k === i ? { ...r, t } : r)));
  };

  const save = async (mode: 'lrc' | 'plain' | 'clear') => {
    let lyrics = '';
    if (mode === 'lrc') lyrics = buildLrc(rows.map((r) => ({ t: r.t ?? 0, text: r.text })));
    else if (mode === 'plain') lyrics = rows.map((r) => r.text).join('\n');
    setSaving(true);
    try {
      await api.put(`/distro/tracks/${track.id}/lyrics`, { lyrics });
      success(mode === 'lrc' ? 'Paroles synchronisées enregistrées !' : mode === 'plain' ? 'Paroles (texte simple) enregistrées.' : 'Paroles supprimées.');
      onSaved();
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <audio ref={audioRef} src={track.audio_url} controls preload="metadata" className="w-full" />

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary !px-6 !py-4 text-base" onClick={tap} disabled={!rows.length || cursor >= rows.length}>
          <Timer size={18} /> TOP — début de la ligne
        </button>
        <button className="btn btn-ghost !px-4 !py-3" onClick={undo} disabled={cursor === 0}>
          <Undo2 size={16} /> Annuler le dernier
        </button>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted" title="Retire le temps de réaction de votre doigt à chaque top">
          Compensation
          <input type="number" step={0.05} min={0} max={1} value={latency} onChange={(e) => setLatency(Math.min(1, Math.max(0, Number(e.target.value) || 0)))} className="field !w-20 !py-1.5 text-center" />
          s
        </label>
      </div>
      <p className="text-xs text-muted">
        Lancez la lecture, puis appuyez sur <strong className="text-fg">TOP</strong> (ou la barre d'espace) à l'instant exact où chaque ligne commence à être chantée. Vous pouvez corriger n'importe quel temps à la main ensuite.
      </p>

      <div className="flex items-center justify-between">
        <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-muted">
          {timed} / {rows.length} ligne{rows.length > 1 ? 's' : ''} calée{timed > 1 ? 's' : ''}
        </span>
        <button className="btn btn-ghost !px-3 !py-2 text-xs" onClick={() => setEditText((v) => !v)}>
          <AlignLeft size={14} /> {editText ? 'Fermer le texte' : 'Modifier le texte'}
        </button>
      </div>

      {editText ? (
        <div>
          <textarea className="field min-h-[200px] resize-y" value={rawText} onChange={(e) => setRawText(e.target.value)} placeholder="Une ligne de paroles par ligne…" />
          <div className="mt-2 flex justify-end gap-2">
            <button className="btn btn-ghost !px-4 !py-2.5" onClick={() => setEditText(false)}>
              Annuler
            </button>
            <button className="btn btn-primary !px-4 !py-2.5" onClick={applyText}>
              <Check size={15} /> Valider le texte
            </button>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted">
          Aucune parole pour ce morceau. Cliquez sur « Modifier le texte », collez les paroles (une ligne par ligne), puis validez.
        </div>
      ) : (
        <div ref={listRef} className="max-h-[40vh] space-y-1 overflow-y-auto rounded-2xl border border-line bg-card p-2">
          {rows.map((r, i) => (
            <div
              key={i}
              data-row={i}
              className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${i === cursor ? 'bg-accent/15 ring-1 ring-accent' : ''}`}
            >
              <input
                key={`${i}-${r.t}`}
                className="field !w-[88px] shrink-0 !px-2 !py-1.5 text-center font-mono text-xs"
                defaultValue={r.t === null ? '' : formatStamp(r.t)}
                placeholder="--:--.--"
                onBlur={(e) => setTime(i, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                aria-label={`Temps de la ligne ${i + 1}`}
              />
              <button
                className="min-w-0 flex-1 truncate text-left text-sm hover:text-accent"
                title="Écouter depuis cette ligne"
                onClick={() => {
                  const audio = audioRef.current;
                  if (audio && r.t !== null) {
                    audio.currentTime = Math.max(0, r.t - 0.3);
                    void audio.play();
                  }
                }}
              >
                {r.text}
              </button>
              {r.t !== null && (
                <button className="icon-btn h-7 w-7 shrink-0 text-muted hover:text-fg" aria-label="Effacer ce temps" onClick={() => setRows((p) => p.map((x, k) => (k === i ? { ...x, t: null } : x)))}>
                  <RotateCcw size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        <button className="btn btn-danger !px-4 !py-2.5" onClick={() => save('clear')} disabled={saving}>
          <Trash2 size={15} /> Supprimer les paroles
        </button>
        <button className="btn btn-ghost !px-4 !py-2.5" onClick={() => save('plain')} disabled={saving || !rows.length}>
          Enregistrer sans synchro
        </button>
        <button className="btn btn-primary !px-5 !py-2.5" onClick={() => save('lrc')} disabled={saving || !complete} title={complete ? '' : 'Calez toutes les lignes pour activer la synchronisation'}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer synchronisées
        </button>
      </div>
    </div>
  );
}

/** Fenêtre « Paroles synchronisées » d'une sortie déjà publiée. */
export function LyricsSyncModal({ release, onClose, onSaved }: { release: Release | null; onClose: () => void; onSaved: () => void }) {
  const { error: toastError } = useToast();
  const [tracks, setTracks] = useState<DistroTrack[] | null>(null);
  const [trackId, setTrackId] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!release) return;
    let alive = true;
    setTracks(null);
    setTrackId(null);
    fetchEditableRelease(release.id)
      .then((res) => {
        if (!alive) return;
        setTracks(res.tracks);
        setTrackId(res.tracks[0]?.id ?? null);
      })
      .catch((e: Error) => {
        toastError(e.message);
        onClose();
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [release?.id, revision]);

  const track = tracks?.find((t) => t.id === trackId) ?? null;

  return (
    <Modal open={!!release} onClose={onClose} title={release ? `Paroles synchronisées · ${release.title}` : ''} size="lg">
      <div className="px-5 py-5 sm:px-7">
        {!tracks ? (
          <div className="grid place-items-center py-16 text-muted">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="label flex items-center gap-2">
                <Mic2 size={14} /> Morceau
              </label>
              <select className="field" value={trackId ?? ''} onChange={(e) => setTrackId(Number(e.target.value))}>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.track_number}. {t.title}
                    {t.lyrics.trim() ? (parseLyrics(t.lyrics).synced ? ' — synchronisé' : ' — paroles') : ''}
                  </option>
                ))}
              </select>
            </div>
            {track && (
              <Editor
                key={`${track.id}-${revision}`}
                track={track}
                onSaved={() => {
                  setRevision((r) => r + 1);
                  onSaved();
                }}
              />
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
