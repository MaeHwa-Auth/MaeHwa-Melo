import type { LocalPlayer } from "../../player/LocalPlayer";
import type { SpotifyPlayer } from "../../services/spotify";
import type { PlaybackSnapshot, Track } from "../../types";
import { safeQueueForTrack, sameTrackId } from "./queue";
import type { RestoreState } from "./persistence";

interface PlayTrackOptions {
  current: () => Track | null;
  setCurrent: (track: Track | null) => void;
  snapshot: () => PlaybackSnapshot;
  setSnapshot: (snapshot: PlaybackSnapshot) => void;
  tracks: () => Track[];
  playQueue: () => Track[];
  setPlayQueue: (tracks: Track[]) => void;
  selectedPlaylistId: () => string | null;
  selectedPlaylistTracks: () => Track[];
  playlistName: (id: string) => string | undefined;
  playbackPlaylistId: () => string | null;
  setPlaybackPlaylistId: (id: string | null) => void;
  setPlaybackPlaylistName: (name: string) => void;
  restoreState: () => RestoreState;
  setRestoreState: (state: RestoreState) => void;
  setRestoredPlaybackPending: (pending: boolean) => void;
  setPendingTrackSelection: (selection: { trackId: string; expiresAt: number } | null) => void;
  pendingTrackSelection: () => { trackId: string; expiresAt: number } | null;
  recordRecentTrack: (trackId: string) => void;
  isSpotifyReady: () => boolean;
  connectSpotify: () => Promise<void>;
  localPlayer: LocalPlayer;
  spotifyPlayer: SpotifyPlayer;
  persistPlayback: () => void;
  patchCurrentTrackUi: () => void;
  showNotice: (message: string) => void;
}

export function createTrackPlayback(options: PlayTrackOptions) {
  return async function playTrack(track: Track, queue: Track[] = [track], displayContext?: string): Promise<void> {
    try {
      if (displayContext) {
        options.setPlaybackPlaylistName(displayContext);
      } else if (queue !== options.playQueue()) {
        const selectedPlaylistId = options.selectedPlaylistId();
        const belongsToSelectedPlaylist = Boolean(selectedPlaylistId && options.selectedPlaylistTracks().some((item) => sameTrackId(item, track)) && queue.some((item) => sameTrackId(item, track)));
        if (belongsToSelectedPlaylist) {
          options.setPlaybackPlaylistId(selectedPlaylistId);
          options.setPlaybackPlaylistName(selectedPlaylistId === "liked-songs" ? "좋아요 표시한 곡" : options.playlistName(selectedPlaylistId!) ?? "Spotify 플레이리스트");
        } else {
          options.setPlaybackPlaylistId(null);
          options.setPlaybackPlaylistName("내 라이브러리");
        }
      } else if (options.selectedPlaylistId() && options.selectedPlaylistTracks().some((item) => sameTrackId(item, track))) {
        options.setPlaybackPlaylistId(options.selectedPlaylistId());
      }
      options.setRestoredPlaybackPending(false);
      const restoreState = options.restoreState();
      const seekToRestore = restoreState.trackId === track.id ? restoreState.position ?? 0 : 0;
      options.setRestoreState({ ...restoreState, trackId: track.id, position: seekToRestore, playlistId: options.playbackPlaylistId() ?? undefined });
      options.recordRecentTrack(track.id);
      const safeQueue = safeQueueForTrack(track, queue);
      options.setPlayQueue(safeQueue);
      let snapshot = options.snapshot();
      options.setSnapshot({ ...snapshot, queue: safeQueue.filter((item) => !sameTrackId(item, track)) });
      if (track.source === "local") {
        await options.spotifyPlayer.pause().catch(() => undefined);
        options.setCurrent(track);
        snapshot = options.snapshot();
        options.setSnapshot({ ...snapshot, current: track, playing: true, position: seekToRestore, duration: track.duration ?? 0 });
        options.persistPlayback();
        options.patchCurrentTrackUi();
        options.localPlayer.setTracks(options.tracks().filter((item) => item.source === "local"));
        await options.localPlayer.play(track);
        if (seekToRestore > 0) await options.localPlayer.seek(seekToRestore);
      } else {
        if (!options.isSpotifyReady()) await options.connectSpotify();
        if (!options.isSpotifyReady()) return;
        options.localPlayer.pause();
        options.setPendingTrackSelection({ trackId: track.spotifyUri ?? track.id, expiresAt: Date.now() + 6000 });
        options.setCurrent(track);
        snapshot = options.snapshot();
        options.setSnapshot({ ...snapshot, current: track, playing: true, position: 0, duration: track.duration ?? 0 });
        options.setRestoreState({ ...options.restoreState(), position: 0, duration: track.duration ?? 0 });
        options.persistPlayback();
        await options.spotifyPlayer.play(track);
        options.patchCurrentTrackUi();
      }
    } catch (error) {
      if (options.pendingTrackSelection()?.trackId === (track.spotifyUri ?? track.id)) options.setPendingTrackSelection(null);
      options.showNotice(error instanceof Error ? error.message : "재생할 수 없습니다.");
    }
  };
}
