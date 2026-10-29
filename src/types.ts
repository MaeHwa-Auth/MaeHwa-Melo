export type TrackSource = "local" | "spotify";
export type AppPage = "home" | "library" | "settings" | "album" | "artist";

export interface Track {
  id: string;
  source: TrackSource;
  title: string;
  artist: string;
  /** Individual credited artists when the source provides a structured list. */
  artists?: string[];
  /** Spotify artist IDs aligned by index with `artists`. */
  artistIds?: string[];
  album: string;
  albumId?: string;
  albumArtist?: string;
  artwork?: string;
  duration?: number;
  addedAt?: string;
  localPath?: string;
  spotifyUri?: string;
  trackNumber?: number;
  discNumber?: number;
  year?: number;
  releaseDate?: string;
  musicBrainzReleaseId?: string;
  musicBrainzRecordingId?: string;
  musicBrainzArtistId?: string;
  musicBrainzReleaseArtistId?: string;
  musicBrainzReleaseGroupId?: string;
  genre?: string;
  available?: boolean;
}

export interface PlaybackSnapshot {
  current: Track | null;
  playing: boolean;
  position: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  queue: Track[];
}

export interface PlayerAdapter {
  play(track: Track): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(seconds: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  setShuffle(enabled: boolean): Promise<void>;
  setRepeat(mode: PlaybackSnapshot["repeat"]): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  destroy(): void;
}
