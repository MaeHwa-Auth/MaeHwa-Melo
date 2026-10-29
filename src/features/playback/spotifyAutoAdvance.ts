import type { PlaybackSnapshot, Track } from "../../types";
import { normalizeTrackKey, sameTrackId } from "./queue";

interface SdkPlaybackState {
  trackKey: string;
  position: number;
  playing: boolean;
}

interface SpotifyAutoAdvanceOptions {
  current: () => Track | null;
  snapshot: () => PlaybackSnapshot;
  setSnapshot: (snapshot: PlaybackSnapshot) => void;
  restoreVolume: () => number | undefined;
  queue: () => Track[];
  autoAdvanceLock: () => string;
  setAutoAdvanceLock: (key: string) => void;
  resolvePlaybackIntent: (playing: boolean) => boolean;
  nextTrack: () => Promise<void>;
  patchProgress: () => void;
  playbackIntent: () => { playing: boolean; expiresAt: number } | null;
}

function normalizeTrackMetadata(value: string | undefined): string {
  return (value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function createSpotifyAutoAdvance(options: SpotifyAutoAdvanceOptions) {
  let previousSdkPlayback: SdkPlaybackState | null = null;

  return function onSpotifyPlaybackUpdate(track: Track | null, position: number, duration: number, playing: boolean): void {
    const current = options.current();
    const snapshot = options.snapshot();
    const sdkTrackKey = normalizeTrackKey(track);
    const selectedTrackKey = normalizeTrackKey(current);
    const idsMatch = Boolean(track && sameTrackId(current, track));
    const durationDifference = current?.duration == null ? Infinity : Math.abs(current.duration - duration);
    const metadataMatches = Boolean(
      current && track && normalizeTrackMetadata(current.title) &&
      normalizeTrackMetadata(current.title) === normalizeTrackMetadata(track.title) &&
      normalizeTrackMetadata(current.artist) === normalizeTrackMetadata(track.artist) &&
      duration > 0 && durationDifference <= 0.25
    );
    const isSelectedTrack = idsMatch || metadataMatches;
    // Treat a verified alternate Spotify catalog URI as the selected track for
    // position updates and end-of-track tracking, while retaining the app URI.
    const currentTrackKey = isSelectedTrack ? selectedTrackKey : sdkTrackKey;
    const endDuration = duration || snapshot.duration;
    const reachedTrackEnd = Boolean(
      isSelectedTrack && duration > 0 && position >= duration - 0.35 &&
      (playing || (previousSdkPlayback?.trackKey === currentTrackKey && previousSdkPlayback.playing && position > previousSdkPlayback.position + 0.05))
    );
    const resetAfterTrackEnd = Boolean(
      current?.source === "spotify" && previousSdkPlayback?.trackKey === selectedTrackKey &&
      previousSdkPlayback.playing && endDuration > 0 && previousSdkPlayback.position >= endDuration - 1.5 &&
      (!track || (isSelectedTrack && position <= 1 && position < previousSdkPlayback.position - 0.5))
    );
    if (track && current && isSelectedTrack) {
      // If the app recently issued a play/pause intent, avoid letting the
      // SDK event immediately override that intent.
      const intent = options.playbackIntent?.();
      if (intent && Date.now() < intent.expiresAt) {
        console.debug("[spotifyAutoAdvance] skipping SDK update due to playbackIntent", intent);
      } else {
        const resolved = options.resolvePlaybackIntent(playing);
        console.debug("[spotifyAutoAdvance] applying SDK update", { playing, resolved });
        options.setSnapshot({ ...snapshot, volume: options.restoreVolume() ?? snapshot.volume, current, position, duration: current.duration ?? duration, playing: resolved });
      }
    }

    const queue = options.queue();
    const latestSnapshot = options.snapshot();
    if ((reachedTrackEnd || resetAfterTrackEnd) && latestSnapshot.repeat !== "one" && options.autoAdvanceLock() !== selectedTrackKey && queue.length > 1) {
      const index = queue.findIndex((item) => sameTrackId(item, current));
      const hasNext = latestSnapshot.shuffle
        ? queue.some((item) => !sameTrackId(item, current))
        : index >= 0 && index < queue.length - 1;
      const allowRepeatAll = latestSnapshot.repeat === "all";
      if (hasNext || allowRepeatAll) {
        options.setAutoAdvanceLock(selectedTrackKey);
        window.setTimeout(() => {
          void options.nextTrack();
          window.setTimeout(() => { options.setAutoAdvanceLock(""); }, 1500);
        }, 180);
      }
    }

    if (track && !sameTrackId(options.current(), track)) options.setAutoAdvanceLock("");
    previousSdkPlayback = { trackKey: currentTrackKey, position, playing };
    options.patchProgress();
  };
}
