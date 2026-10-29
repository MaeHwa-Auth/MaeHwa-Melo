import type { LocalPlayer } from "../../player/LocalPlayer";
import type { SpotifyPlayer } from "../../services/spotify";
import type { PlaybackSnapshot, Track } from "../../types";

interface TogglePlayOptions {
  current: () => Track | null;
  snapshot: () => PlaybackSnapshot;
  setSnapshot: (snapshot: PlaybackSnapshot) => void;
  playbackIntent: () => { playing: boolean; expiresAt: number } | null;
  setPlaybackIntent: (intent: { playing: boolean; expiresAt: number } | null) => void;
  restoredPlaybackPending: () => boolean;
  setRestoredPlaybackPending: (pending: boolean) => void;
  spotifyReady: () => boolean;
  connectSpotify: () => Promise<void>;
  queue: () => Track[];
  firstTrack: () => Track | undefined;
  playTrack: (track: Track, queue?: Track[]) => Promise<void>;
  addFolder: () => Promise<void>;
  localPlayer: LocalPlayer;
  spotifyPlayer: SpotifyPlayer;
  patchProgress: () => void;
  showNotice: (message: string) => void;
}

export function createTogglePlay(options: TogglePlayOptions) {
  return async function togglePlay(): Promise<void> {
    console.debug("[togglePlay] called, current playing=", options.snapshot().playing);
    let current = options.current();
    if (!current) {
      if (options.firstTrack()) await options.playTrack(options.firstTrack()!);
      else await options.addFolder();
      return;
    }
    const wasPlaying = options.snapshot().playing;
    const targetPlaying = !wasPlaying;
    options.setPlaybackIntent({ playing: targetPlaying, expiresAt: Date.now() + 1800 });

    try {
      if (current.source === "local") {
        if (!targetPlaying) {
          console.debug("[togglePlay] calling localPlayer.pause()");
          await options.localPlayer.pause();
          options.setSnapshot({ ...options.snapshot(), playing: false });
          options.patchProgress();
          return;
        }
        if (!options.localPlayer.audio.src) {
          await options.playTrack(current, options.queue().length ? options.queue() : [current]);
          return;
        }
        await options.localPlayer.resume();
        console.debug("[togglePlay] localPlayer.resume() done");
        options.setSnapshot({ ...options.snapshot(), playing: true });
        options.patchProgress();
        return;
      }

      if (!targetPlaying) {
        console.debug("[togglePlay] calling spotifyPlayer.pause()");
        await options.spotifyPlayer.pause();
        options.setSnapshot({ ...options.snapshot(), playing: false });
        options.patchProgress();
        return;
      }

      if (options.restoredPlaybackPending()) {
        const resumePosition = options.snapshot().position;
        if (!options.spotifyReady()) await options.connectSpotify();
        if (!options.spotifyReady()) {
          options.setPlaybackIntent(null);
          options.setSnapshot({ ...options.snapshot(), playing: wasPlaying });
          options.patchProgress();
          return;
        }
        current = options.current() ?? current;
        await options.spotifyPlayer.play(current, resumePosition);
        console.debug("[togglePlay] spotifyPlayer.play() done (restored)");
        options.setRestoredPlaybackPending(false);
        options.setSnapshot({ ...options.snapshot(), playing: true });
        options.patchProgress();
        return;
      }

      if (!options.spotifyReady()) {
        await options.playTrack(current, options.queue().length ? options.queue() : [current]);
        return;
      }

      await options.spotifyPlayer.resume();
      console.debug("[togglePlay] spotifyPlayer.resume() done");
      options.setSnapshot({ ...options.snapshot(), playing: true });
      options.patchProgress();
      if (options.current()?.source === "local") options.setRestoredPlaybackPending(false);
    } catch (error) {
      options.setPlaybackIntent(null);
      options.setSnapshot({ ...options.snapshot(), playing: wasPlaying });
      options.patchProgress();
      options.showNotice(error instanceof Error ? error.message : "재생 상태를 변경하지 못했습니다.");
    }
  };
}
