import type { Track } from "../../types";

export function normalizeTrackKey(track?: Pick<Track, "id" | "spotifyUri"> | null): string {
  return track?.spotifyUri ?? track?.id ?? "";
}

export function sameTrackId(left: Track | null | undefined, right: Track | null | undefined): boolean {
  return normalizeTrackKey(left) !== "" && normalizeTrackKey(left) === normalizeTrackKey(right);
}

export function currentQueueIndex(current: Track | null, queue: Track[]): number {
  if (!current) return -1;
  const exactIndex = queue.findIndex((track) => sameTrackId(track, current));
  if (exactIndex >= 0 || current.source !== "spotify") return exactIndex;
  const normalize = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return queue.findIndex((track) => {
    const durationDifference = Math.abs((track.duration ?? 0) - (current.duration ?? 0));
    return track.source === "spotify" &&
      normalize(track.title) === normalize(current.title) &&
      normalize(track.artist) === normalize(current.artist) &&
      track.duration != null && current.duration != null && durationDifference <= 0.25;
  });
}

export function safeQueueForTrack(track: Track, queue: Track[] = [track]): Track[] {
  return queue.some((item) => sameTrackId(item, track)) ? queue : [track];
}

export function nextQueueIndex(currentTrack: Track | null, queue: Track[]): number {
  if (!currentTrack) return -1;
  const index = currentQueueIndex(currentTrack, queue);
  return index >= 0 ? index + 1 : 0;
}
