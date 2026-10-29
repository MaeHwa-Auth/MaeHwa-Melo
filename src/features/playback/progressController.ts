import type { PlaybackSnapshot, Track } from "../../types";
import type { RestoreState } from "./persistence";
import { patchProgressUi } from "./progressUi";

interface ProgressControllerOptions {
  app: HTMLElement;
  current: () => Track | null;
  snapshot: () => PlaybackSnapshot;
  restoreState: () => RestoreState;
  setRestoreState: (state: RestoreState) => void;
  patchTrackRows: () => void;
  patchAlbumCards: () => void;
  setLyricClock: (snapshot: PlaybackSnapshot, current: Track | null, now: number) => void;
  icon: (name: string) => string;
  updateSyncedLyrics: () => void;
  persistPlayback: () => void;
}

export function createProgressController(options: ProgressControllerOptions): { patchProgress: () => void } {
  let lastTrackId = "";

  function patchProgress(): void {
    const current = options.current();
    const snapshot = options.snapshot();
    options.app.querySelector<HTMLElement>(".app-shell")?.classList.toggle("is-playing", snapshot.playing);
    options.patchTrackRows();
    options.patchAlbumCards();
    options.setLyricClock(snapshot, current, performance.now());
    patchProgressUi({
      app: options.app,
      current,
      snapshot,
      lastTrackId: () => lastTrackId,
      setLastTrackId: (value) => { lastTrackId = value; },
      icon: options.icon,
      updateSyncedLyrics: options.updateSyncedLyrics,
    });

    const wholePosition = Math.floor(snapshot.position);
    const restoreState = options.restoreState();
    if (current && wholePosition % 5 === 0 && restoreState.position !== wholePosition) {
      options.setRestoreState({ ...restoreState, trackId: current.id, position: wholePosition, volume: snapshot.volume, shuffle: snapshot.shuffle, repeat: snapshot.repeat });
      options.persistPlayback();
    }
  }

  return { patchProgress };
}
