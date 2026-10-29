import { spotifyAlbumTracks, spotifyEarliestAlbumForTrack, spotifyConnected } from "../../services/spotify";
import type { SpotifyAlbumDetails } from "../../services/spotify";
import type { Track } from "../../types";
import { sameTrackId } from "../playback/queue";

interface AlbumResolverOptions {
  tracks: () => Track[];
  spotifyTracks: () => Track[];
  selectedPlaylistTracks: () => Track[];
  playQueue: () => Track[];
  albumGroupingKey: (track: Track) => string;
}

function localAlbumFallback(track: Track, collection: Track[], albumGroupingKey: (track: Track) => string): SpotifyAlbumDetails {
  const key = albumGroupingKey(track);
  const albumTracks = track.album.trim() ? collection.filter((item) => albumGroupingKey(item) === key) : [track];
  if (!albumTracks.some((item) => sameTrackId(item, track))) albumTracks.push(track);
  return {
    id: track.albumId ?? key,
    name: track.album.trim() && track.album !== "Spotify" ? track.album : track.title,
    artist: track.albumArtist || track.artist,
    artwork: track.artwork,
    releaseDate: track.year ? String(track.year) : undefined,
    tracks: [...new Map(albumTracks.map((item) => [item.id, item])).values()],
  };
}

export function createCurrentAlbumResolver(options: AlbumResolverOptions) {
  return async function resolveCurrentAlbum(track: Track): Promise<{ album: SpotifyAlbumDetails; fallback: boolean }> {
    const collection = [...options.tracks(), ...options.spotifyTracks(), ...options.selectedPlaylistTracks(), ...options.playQueue()];
    const groupKey = options.albumGroupingKey(track);
    if (track.source === "spotify" && spotifyConnected()) {
      try {
        try { return { album: await spotifyEarliestAlbumForTrack(track), fallback: false }; }
        catch (error) {
          if (!track.albumId) throw error;
          return { album: await spotifyAlbumTracks(track.albumId), fallback: false };
        }
      } catch {
        const album = localAlbumFallback(track, collection, options.albumGroupingKey);
        return { album, fallback: album.tracks.length === 1 };
      }
    }
    const albumTracks = track.album.trim() ? collection.filter((item) => options.albumGroupingKey(item) === groupKey) : [track];
    if (!albumTracks.some((item) => sameTrackId(item, track))) albumTracks.push(track);
    return {
      fallback: false,
      album: {
        id: track.albumId ?? groupKey,
        name: track.album.trim() || track.title,
        artist: track.albumArtist || track.artist,
        artwork: track.artwork,
        releaseDate: track.year ? String(track.year) : undefined,
        tracks: [...new Map(albumTracks.map((item) => [item.id, item])).values()],
      },
    };
  };
}
