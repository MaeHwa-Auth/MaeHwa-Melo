import type { Track } from "../../types";

const STORAGE_KEY = "maehwa.recent.v1";

export function readRecentTrackIds(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as string[]; }
  catch { return []; }
}

export function recordRecentTrack(previousIds: string[], trackId: string): string[] {
  const recentIds = [trackId, ...previousIds.filter((id) => id !== trackId)].slice(0, 30);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(recentIds)); }
  catch { /* Keep playback available when local storage is full. */ }
  return recentIds;
}

export function resolveRecentTracks(ids: string[], tracks: Track[], limit = 8): Track[] {
  return ids.map((id) => tracks.find((track) => track.id === id)).filter((track): track is Track => Boolean(track)).slice(0, limit);
}
