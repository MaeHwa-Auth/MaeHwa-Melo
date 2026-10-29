import type { PlaybackSnapshot } from "../../types";
import type { TrackLyrics } from "../../services/lrclib";

interface SyncedLyricsOptions {
  app: HTMLElement;
  currentTrackId: () => string | undefined;
  lyrics: () => TrackLyrics | null;
  snapshot: () => PlaybackSnapshot;
  clock: () => { position: number; at: number; trackId: string; playing: boolean };
  activeIndex: () => number;
  setActiveIndex: (index: number) => void;
  lastScrolledIndex: () => number;
  setLastScrolledIndex: (index: number) => void;
  manualScrollUntil: () => number;
}

export function createSyncedLyricsUpdater(options: SyncedLyricsOptions): () => void {
  return () => {
    const lyrics = options.lyrics();
    if (!lyrics?.synced) return;
    const trackId = options.currentTrackId();
    const clock = options.clock();
    const snapshot = options.snapshot();
    const position = clock.trackId === trackId && clock.playing
      ? clock.position + Math.max(0, performance.now() - clock.at) / 1000
      : snapshot.position;
    let nextIndex = -1;
    for (let index = 0; index < lyrics.lines.length; index++) {
      const time = lyrics.lines[index].time;
      if (time !== null && time <= position) nextIndex = index;
      else if (time !== null) break;
    }
    const changed = nextIndex !== options.activeIndex();
    if (changed) options.setActiveIndex(nextIndex);
    const container = options.app.querySelector<HTMLElement>("[data-lyrics-scroll]");
    const lines = container?.querySelectorAll<HTMLElement>("[data-lyric-index]");
    if (changed) lines?.forEach((line) => line.classList.toggle("active", Number(line.dataset.lyricIndex) === nextIndex));
    if (lyrics.wordSynced && lines) {
      lines.forEach((line) => {
        const words = line.querySelectorAll<HTMLElement>("[data-word-time]");
        if (!words.length) return;
        let activeWord = -1;
        words.forEach((word, index) => { if (Number(word.dataset.wordTime) <= position) activeWord = index; });
        words.forEach((word, index) => word.classList.toggle("active", Number(line.dataset.lyricIndex) === nextIndex && index === activeWord));
      });
    }
    if (container && nextIndex >= 0 && Date.now() >= options.manualScrollUntil() && (changed || options.lastScrolledIndex() !== nextIndex)) {
      const active = container.querySelector<HTMLElement>(`[data-lyric-index="${nextIndex}"]`);
      if (active) {
        const top = Math.max(0, active.offsetTop - container.offsetTop - container.clientHeight / 2 + active.clientHeight / 2);
        container.scrollTo({ top, behavior: "smooth" });
        options.setLastScrolledIndex(nextIndex);
      }
    }
  };
}
