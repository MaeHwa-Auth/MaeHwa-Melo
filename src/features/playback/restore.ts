import type { LocalPlayer } from "../../player/LocalPlayer";
import type { PlaybackSnapshot, Track } from "../../types";
import type { RestoreState } from "./persistence";

interface PlaybackRestoreOptions {
  tracks: () => Track[];
  restoreState: () => RestoreState;
  snapshot: () => PlaybackSnapshot;
  setSnapshot: (snapshot: PlaybackSnapshot) => void;
  setCurrent: (track: Track | null) => void;
  setRestorePending: (pending: boolean) => void;
  setQueue: (tracks: Track[]) => void;
  localPlayer: LocalPlayer;
}

export function createPlaybackRestore(options: PlaybackRestoreOptions) {
  return function restorePlayback(): void {
    const restoreState = options.restoreState();
    const restored = options.tracks().find((track) => track.id === restoreState.trackId) ?? restoreState.track ?? null;
    let snapshot = options.snapshot();
    snapshot = { ...snapshot, volume: restoreState.volume ?? snapshot.volume, shuffle: restoreState.shuffle ?? false, repeat: restoreState.repeat ?? "off" };
    options.setSnapshot(snapshot);
    void options.localPlayer.setVolume(snapshot.volume);
    if (restored) {
      options.setCurrent(restored);
      options.setRestorePending(true);
      const position = restoreState.position ?? 0;
      snapshot = { ...snapshot, current: restored, position, duration: restoreState.duration ?? restored.duration ?? 0, playing: false };
      options.setSnapshot(snapshot);
      void options.localPlayer.setShuffle(snapshot.shuffle);
      void options.localPlayer.setRepeat(snapshot.repeat);
      options.setQueue([restored]);
      if (restored.source === "local" && restored.localPath && restored.available !== false) options.localPlayer.prepare(restored, position);
    }
  };
}
