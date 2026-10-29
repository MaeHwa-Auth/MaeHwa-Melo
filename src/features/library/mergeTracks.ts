import type { Track } from "../../types";

export function mergeTracks(...groups: Track[][]): Track[] {
  const unique = new Map<string, Track>();
  for (const group of groups) {
    for (const track of group) {
      const previous = unique.get(track.id);
      unique.set(track.id, { ...previous, ...track, artwork: track.artwork ?? previous?.artwork });
    }
  }
  return [...unique.values()];
}
