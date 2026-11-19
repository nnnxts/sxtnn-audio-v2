import { useCallback } from 'react';
import { api } from './api';
import type { Release, Track } from './types';
import { usePlayer } from '../context/PlayerContext';
import { useToast } from '../context/ToastContext';

/** Lance la lecture d'une sortie entière (charge ses pistes puis les met en file d'attente). */
export function usePlayRelease() {
  const { playTracks, playShuffled } = usePlayer();
  const { error } = useToast();

  return useCallback(
    async (releaseId: number, opts?: { shuffle?: boolean }) => {
      try {
        const res = await api.get<{ release: Release; tracks: Track[] }>(`/releases/${releaseId}`);
        if (!res.tracks.length) return;
        if (opts?.shuffle) playShuffled(res.tracks);
        else playTracks(res.tracks, 0);
      } catch (e) {
        error((e as Error).message);
      }
    },
    [playTracks, playShuffled, error]
  );
}
