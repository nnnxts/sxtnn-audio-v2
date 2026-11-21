import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlignLeft, Disc3, Heart, ListEnd, ListPlus, ListX, Pause, Play, User as UserIcon } from 'lucide-react';
import type { Track } from '../lib/types';
import { formatCount, formatDuration } from '../lib/format';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { Cover } from './ui/Cover';
import { Equalizer } from './ui/Misc';
import { ExplicitMark, FriendsBadge, LeakBadge } from './ui/Badges';
import { MenuButton, type MenuItem } from './ui/Menu';
import { Modal } from './ui/Modal';
import { LikeButton } from './LikeButton';
import { LyricsView } from './LyricsView';

interface TrackRowProps {
  track: Track;
  /** Liste complète dans laquelle ce titre est joué (devient la file d'attente) */
  tracks: Track[];
  index: number;
  /** "number" : numéro de piste (page sortie) · "rank" : classement · "index" : position dans la liste · "plain" : sans numéro */
  lead?: 'number' | 'rank' | 'index' | 'plain';
  showCover?: boolean;
  showPlays?: boolean;
  showAlbum?: boolean;
  /** Élément placé tout à gauche (ex : poignée de glisser-déposer) */
  handle?: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
}

export function TrackArtists({ track, className = '' }: { track: Track; className?: string }) {
  const mains = track.artists.filter((a) => a.role !== 'feature');
  const feats = track.artists.filter((a) => a.role === 'feature');
  return (
    <span className={`truncate ${className}`}>
      {mains.map((a, i) => (
        <span key={a.id}>
          {i > 0 && ', '}
          <Link to={`/artist/${a.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-fg hover:underline">
            {a.name}
          </Link>
        </span>
      ))}
      {feats.length > 0 && (
        <>
          <span className="opacity-70"> · feat. </span>
          {feats.map((a, i) => (
            <span key={a.id}>
              {i > 0 && ', '}
              <Link to={`/artist/${a.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-fg hover:underline">
                {a.name}
              </Link>
            </span>
          ))}
        </>
      )}
    </span>
  );
}

/** Menu "…" d'un titre (partagé entre les lignes et le lecteur). */
export function TrackMenu({ track, onRemove, removeLabel }: { track: Track; onRemove?: () => void; removeLabel?: string }) {
  const { playNext, addToQueue } = usePlayer();
  const { isLiked, toggleLike, openPlaylistPicker } = useLibrary();
  const navigate = useNavigate();
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const liked = isLiked(track.id);
  const mainArtist = track.artists.find((a) => a.role !== 'feature') ?? track.artists[0];

  const items: MenuItem[] = [
    { label: 'Lire ensuite', icon: <ListEnd size={16} />, onClick: () => playNext(track) },
    { label: "Ajouter à la file d'attente", icon: <ListPlus size={16} />, onClick: () => addToQueue(track) },
    { label: 'Ajouter à une playlist', icon: <ListPlus size={16} />, onClick: () => openPlaylistPicker(track) },
    {
      label: liked ? 'Retirer des coups de cœur' : 'Ajouter aux coups de cœur',
      icon: <Heart size={16} />,
      onClick: () => toggleLike(track),
    },
  ];
  if (track.has_lyrics) items.push({ label: 'Voir les paroles', icon: <AlignLeft size={16} />, onClick: () => setLyricsOpen(true) });
  items.push({ label: 'Voir la sortie', icon: <Disc3 size={16} />, onClick: () => navigate(`/release/${track.release_id}`), divider: true });
  if (mainArtist) items.push({ label: `Aller à ${mainArtist.name}`, icon: <UserIcon size={16} />, onClick: () => navigate(`/artist/${mainArtist.id}`) });
  if (onRemove) items.push({ label: removeLabel ?? 'Retirer', icon: <ListX size={16} />, onClick: onRemove, danger: true, divider: true });

  return (
    <>
      <MenuButton items={items} />
      <Modal open={lyricsOpen} onClose={() => setLyricsOpen(false)} title={`Paroles · ${track.title}`} size="md">
        <div className="px-6 py-6">
          <LyricsView trackId={track.id} />
        </div>
      </Modal>
    </>
  );
}

export function TrackRow({
  track,
  tracks,
  index,
  lead = 'number',
  showCover = false,
  showPlays = true,
  showAlbum = false,
  handle,
  onRemove,
  removeLabel,
}: TrackRowProps) {
  const { currentTrack, isPlaying, playTracks, togglePlay, playCounts } = usePlayer();
  const isCurrent = currentTrack?.id === track.id;
  const playing = isCurrent && isPlaying;
  const plays = playCounts[track.id] ?? track.play_count;

  const onActivate = () => {
    if (isCurrent) togglePlay();
    else playTracks(tracks, index);
  };

  const number = lead === 'rank' || lead === 'index' ? index + 1 : lead === 'number' ? track.track_number || index + 1 : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onActivate();
      }}
      className={`group flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-[var(--row-pad)] transition-colors hover:bg-card ${
        isCurrent ? 'bg-card/70' : ''
      }`}
    >
      {handle}

      {/* Numéro / lecture */}
      {lead !== 'plain' && (
        <div className="grid w-8 shrink-0 place-items-center text-sm tabular-nums text-muted">
          {playing ? (
            <>
              <Equalizer className="group-hover:hidden" />
              <Pause size={16} className="hidden text-fg group-hover:block" fill="currentColor" />
            </>
          ) : (
            <>
              <span className={`group-hover:hidden ${isCurrent ? 'text-accent' : ''} ${lead === 'rank' && index < 3 ? 'font-bold text-fg' : ''}`}>
                {number}
              </span>
              <Play size={16} className="hidden text-fg group-hover:block" fill="currentColor" />
            </>
          )}
        </div>
      )}

      {showCover && (
        <div className="relative">
          <Cover src={track.cover_url} alt={track.release_title} className="h-11 w-11" flat />
          {lead === 'plain' && (
            <span
              className={`absolute inset-0 grid place-items-center rounded-cover bg-black/55 text-white transition-opacity ${
                playing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </span>
          )}
        </div>
      )}

      {/* Titre + artistes */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`truncate text-[15px] font-semibold ${isCurrent ? 'text-accent' : ''}`}>{track.title}</span>
          {track.is_explicit && <ExplicitMark />}
          {track.is_leak && <LeakBadge />}
          {track.visibility === 'friends' && <FriendsBadge />}
        </div>
        <div className="flex items-center gap-1 text-[13px] text-muted">
          <TrackArtists track={track} />
        </div>
      </div>

      {showAlbum && (
        <Link
          to={`/release/${track.release_id}`}
          onClick={(e) => e.stopPropagation()}
          className="hidden w-48 shrink-0 truncate text-sm text-muted hover:text-fg hover:underline lg:block"
        >
          {track.release_title}
        </Link>
      )}

      {showPlays && (
        <span className="hidden w-28 shrink-0 text-right text-sm tabular-nums text-muted sm:block">
          {formatCount(plays)} <span className="text-xs">écoute{plays > 1 ? 's' : ''}</span>
        </span>
      )}

      <div className="flex items-center gap-1">
        <LikeButton
          track={track}
          className="transition-opacity sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100 sm:[&[aria-pressed=true]]:opacity-100"
        />
        <span className="hidden w-11 text-right text-sm tabular-nums text-muted sm:block">{formatDuration(track.duration_seconds)}</span>
        <TrackMenu track={track} onRemove={onRemove} removeLabel={removeLabel} />
      </div>
    </div>
  );
}
