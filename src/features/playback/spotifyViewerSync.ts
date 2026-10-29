import { getLivePlaybackState, spotifyConnected } from "../../services/spotify";
import type { PlaybackSnapshot, Track } from "../../types";

interface SpotifyViewerSyncOptions {
  current: () => Track | null;
  setCurrent: (track: Track | null) => void;
  pendingTrackSelection: () => { trackId: string; expiresAt: number } | null;
  setPendingTrackSelection: (selection: { trackId: string; expiresAt: number } | null) => void;
  setPlaybackPlaylistName: (name: string) => void;
  sameTrackId: (left: Track | null | undefined, right: Track | null | undefined) => boolean;
  resolvePlaybackIntent: (reportedPlaying: boolean) => boolean;
  snapshot: () => PlaybackSnapshot;
  setSnapshot: (snapshot: PlaybackSnapshot) => void;
  patchCurrentTrackUi: () => void;
  patchProgress: () => void;
  playbackIntent: () => { playing: boolean; expiresAt: number } | null;
}

export function createSpotifyViewerSync(options: SpotifyViewerSyncOptions) {
  let interval: number | undefined;
  let inFlight = false;

  async function syncFromApi(): Promise<void> {
    const state = await getLivePlaybackState();
    if (!state) return;

    // Respect an active user intent: if the app recently issued a play/pause
    // command, don't let the poller immediately overwrite that intent.
    const intent = options.playbackIntent?.();
    if (intent && Date.now() < intent.expiresAt) {
      console.debug("[spotifyViewerSync] skipping sync due to active playbackIntent", intent);
      return;
    }

    const nextTrack: Track = {
      id: state.trackUri ?? `spotify-live:${state.trackName}:${state.artistName}`,
      source: "spotify",
      title: state.trackName,
      artist: state.artistName,
      album: "Spotify",
      artwork: state.albumArt,
      spotifyUri: state.trackUri,
      duration: state.durationMs / 1000,
    };

    const pending = options.pendingTrackSelection();
    const current = options.current();
    const currentSpotifySource = current?.source === "spotify";
    const selectedByApp = Boolean(
      pending &&
      Date.now() < pending.expiresAt &&
      currentSpotifySource &&
      nextTrack.id === pending.trackId
    );

    if (pending) {
      if (Date.now() >= pending.expiresAt) {
        options.setPendingTrackSelection(null);
      } else if (currentSpotifySource && nextTrack.id !== pending.trackId) {
        return;
      } else if (selectedByApp) {
        options.setPendingTrackSelection(null);
      }
    }

    if (!selectedByApp) options.setPlaybackPlaylistName("Spotify");

    const trackChanged = !options.sameTrackId(current, nextTrack);
    const trackDetailsChanged = current?.title !== nextTrack.title || current?.artist !== nextTrack.artist || current?.artwork !== nextTrack.artwork;
    const currentTrackChanged = trackChanged || trackDetailsChanged;
    const nextCurrent = currentTrackChanged ? nextTrack : current;
    options.setCurrent(nextCurrent);
    const resolvedPlaying = options.resolvePlaybackIntent(state.isPlaying);
    console.debug("[spotifyViewerSync] syncing state from API", { isPlaying: state.isPlaying, resolvedPlaying });
    options.setSnapshot({
      ...options.snapshot(),
      current: nextCurrent,
      playing: resolvedPlaying,
      position: state.progressMs / 1000,
      duration: state.durationMs / 1000,
    });
    if (currentTrackChanged) options.patchCurrentTrackUi();
    else options.patchProgress();
  }

  function start(): void {
    if (!spotifyConnected()) {
      console.log("[live-viewer] Spotify token missing; skipping poller startup");
      return;
    }
    stop();
    console.log("[live-viewer] Spotify viewer mode started");
    interval = window.setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      void syncFromApi().finally(() => { inFlight = false; });
    }, 3000);
  }

  function stop(): void {
    if (interval !== undefined) {
      clearInterval(interval);
      interval = undefined;
    }
  }

  return { start, stop, syncFromApi };
}
