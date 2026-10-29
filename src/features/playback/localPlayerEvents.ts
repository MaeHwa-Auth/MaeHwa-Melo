import type { LocalPlayer } from "../../player/LocalPlayer";
import type { PlaybackSnapshot, Track } from "../../types";
import { sameTrackId } from "./queue";

interface LocalPlayerEventsOptions {
  localPlayer: LocalPlayer;
  current: () => Track | null;
  snapshot: () => PlaybackSnapshot;
  queue: () => Track[];
  shuffleHistory: () => Track[];
  shuffleHistoryIndex: () => number;
  seek: (position: number) => Promise<void>;
  nextTrack: () => Promise<void>;
  playbackIntent: () => { playing: boolean; expiresAt: number } | null;
  onSnapshot: (snapshot: PlaybackSnapshot) => void;
}

export function bindLocalPlayerEvents(options: LocalPlayerEventsOptions): void {
  options.localPlayer.subscribe((snapshot) => {
    const intent = options.playbackIntent();
    const nextSnapshot = {
      ...snapshot,
      playing: intent && Date.now() < intent.expiresAt ? intent.playing : snapshot.playing,
    };
    options.onSnapshot(nextSnapshot);
  });
  window.addEventListener("maehwa:local-ended", () => {
    const snapshot = options.snapshot();
    const current = options.current();
    if (snapshot.repeat === "one" && current?.source === "local") {
      void options.seek(0).then(() => options.localPlayer.resume());
      return;
    }
    const queue = options.queue();
    const hasShuffledNext = snapshot.shuffle && current && queue.some((track) =>
      !sameTrackId(track, current) && !options.shuffleHistory().slice(0, options.shuffleHistoryIndex() + 1).some((played) => sameTrackId(track, played)));
    if (snapshot.repeat === "all" || hasShuffledNext || (current && !snapshot.shuffle && queue.findIndex((track) => sameTrackId(track, current)) < queue.length - 1)) {
      void options.nextTrack();
    }
  });
}
