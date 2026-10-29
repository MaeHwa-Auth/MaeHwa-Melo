import type { PlaybackSnapshot, Track } from "../../types";

export interface RestoreState {
  trackId?: string;
  track?: Track;
  position?: number;
  duration?: number;
  volume?: number;
  shuffle?: boolean;
  repeat?: PlaybackSnapshot["repeat"];
  playlistId?: string;
}

const STORAGE_KEY = "maehwa.playback.v1";

export function readRestoreState(): RestoreState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function persistPlaybackState(state: RestoreState, current: Track | null, snapshot: PlaybackSnapshot, playlistId: string | null): void {
  try {
    const track = current ? { ...current, artwork: current.artwork?.startsWith("https://") ? current.artwork : undefined } : state.track;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...state,
      track,
      trackId: current?.id ?? state.trackId,
      position: Math.floor(snapshot.position),
      duration: snapshot.duration,
      volume: snapshot.volume,
      shuffle: snapshot.shuffle,
      repeat: snapshot.repeat,
      playlistId: playlistId ?? state.playlistId,
    }));
  } catch {
    // Playback controls keep working when browser storage is unavailable.
  }
}
