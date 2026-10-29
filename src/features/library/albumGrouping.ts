import type { Track } from "../../types";

export function albumGroupingKey(track: Track): string {
  const album = track.album.trim();
  return album ? `${album}\u0000${track.albumArtist || track.artist}`.toLocaleLowerCase() : `single\u0000${track.id}`;
}
