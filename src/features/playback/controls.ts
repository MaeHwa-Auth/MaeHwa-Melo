import type { LocalPlayer } from "../../player/LocalPlayer";
import type { SpotifyPlayer } from "../../services/spotify";
import type { PlaybackSnapshot, Track } from "../../types";
import { nextQueueIndex } from "./queue";

interface PlaybackRestoreState {
  trackId?: string;
  track?: Track;
  position?: number;
  duration?: number;
  volume?: number;
  shuffle?: boolean;
  repeat?: PlaybackSnapshot["repeat"];
  playlistId?: string;
}

interface PlaybackControlsOptions {
  current: () => Track | null;
  snapshot: () => PlaybackSnapshot;
  queue: () => Track[];
  shuffleHistory: () => Track[];
  setShuffleHistory: (tracks: Track[]) => void;
  shuffleHistoryIndex: () => number;
  setShuffleHistoryIndex: (index: number) => void;
  restoreState: () => PlaybackRestoreState;
  setRestoreState: (state: PlaybackRestoreState) => void;
  previousVolume: () => number;
  setPreviousVolume: (volume: number) => void;
  localPlayer: LocalPlayer;
  spotifyPlayer: SpotifyPlayer;
  playTrack: (track: Track, queue?: Track[]) => Promise<void>;
  patchProgress: () => void;
  persistPlayback: () => void;
  render: () => void;
  showNotice: (message: string) => void;
  sameTrackId: (left: Track | null | undefined, right: Track | null | undefined) => boolean;
}

export function createPlaybackControls(options: PlaybackControlsOptions) {
  async function seek(position: number): Promise<void> {
    const current = options.current();
    if (!current) return;
    if (current.source === "local") await options.localPlayer.seek(position);
    else await options.spotifyPlayer.seek(position);
    options.setRestoreState({ ...options.restoreState(), position });
    options.persistPlayback();
  }

  async function setVolume(volume: number): Promise<void> {
    const snapshot = options.snapshot();
    snapshot.volume = Math.max(0, Math.min(1, volume));
    if (snapshot.volume > 0) options.setPreviousVolume(snapshot.volume);
    options.setRestoreState({ ...options.restoreState(), volume: snapshot.volume });
    const current = options.current();
    if (current?.source === "spotify") await options.spotifyPlayer.setVolume(snapshot.volume);
    else await options.localPlayer.setVolume(snapshot.volume);
    options.patchProgress();
    options.persistPlayback();
  }

  async function toggleMute(): Promise<void> {
    const volume = options.snapshot().volume;
    await setVolume(volume === 0 ? options.previousVolume() : 0);
  }

  async function nextTrack(): Promise<void> {
    const current = options.current();
    const queue = options.queue();
    const snapshot = options.snapshot();
    if (current && queue.length) {
      if (snapshot.shuffle && queue.length > 1) {
        const history = options.shuffleHistory();
        let historyIndex = options.shuffleHistoryIndex();
        if (historyIndex + 1 < history.length) {
          const forwardTrack = history[historyIndex + 1];
          options.setShuffleHistoryIndex(historyIndex + 1);
          await options.playTrack(forwardTrack, queue);
          return;
        }
        let candidates = queue.filter((track) => !options.sameTrackId(track, current) && !history.slice(0, historyIndex + 1).some((played) => options.sameTrackId(track, played)));
        if (!candidates.length && snapshot.repeat === "all") {
          candidates = queue.filter((track) => !options.sameTrackId(track, current));
          historyIndex = current ? 0 : -1;
          options.setShuffleHistory(current ? [current] : []);
          options.setShuffleHistoryIndex(historyIndex);
        }
        if (!candidates.length) return;
        const shuffledTrack = candidates[Math.floor(Math.random() * candidates.length)];
        const nextHistory = [...options.shuffleHistory().slice(0, options.shuffleHistoryIndex() + 1), shuffledTrack];
        options.setShuffleHistory(nextHistory);
        options.setShuffleHistoryIndex(nextHistory.length - 1);
        await options.playTrack(shuffledTrack, queue);
        return;
      }
      const nextTrackFromQueue = queue[nextQueueIndex(current, queue)];
      if (nextTrackFromQueue) { await options.playTrack(nextTrackFromQueue, queue); return; }
      if (snapshot.repeat === "all" && queue[0]) { await options.playTrack(queue[0], queue); return; }
      return;
    }
    if (current?.source === "spotify") await options.spotifyPlayer.next();
    else await options.localPlayer.next();
  }

  async function previousTrack(): Promise<void> {
    const current = options.current();
    const snapshot = options.snapshot();
    const queue = options.queue();
    if (current?.source === "local" && snapshot.position > 3) { await options.localPlayer.seek(0); return; }
    if (snapshot.shuffle && options.shuffleHistoryIndex() > 0) {
      const nextIndex = options.shuffleHistoryIndex() - 1;
      const previousShuffledTrack = options.shuffleHistory()[nextIndex];
      options.setShuffleHistoryIndex(nextIndex);
      await options.playTrack(previousShuffledTrack, queue);
      return;
    }
    if (current && queue.length) {
      const currentIndex = queue.findIndex((track) => options.sameTrackId(track, current));
      const previous = Math.max(0, currentIndex - 1);
      const previousTrack = queue[previous];
      if (previousTrack) { await options.playTrack(previousTrack, queue); return; }
    }
    if (current?.source === "spotify") await options.spotifyPlayer.previous();
    else await options.localPlayer.previous();
  }

  async function toggleShuffle(): Promise<void> {
    const current = options.current();
    const snapshot = options.snapshot();
    snapshot.shuffle = !snapshot.shuffle;
    const history = snapshot.shuffle && current ? [current] : [];
    options.setShuffleHistory(history);
    options.setShuffleHistoryIndex(history.length - 1);
    options.setRestoreState({ ...options.restoreState(), shuffle: snapshot.shuffle });
    options.persistPlayback();
    options.render();
    try {
      if (current?.source === "spotify") await options.spotifyPlayer.shuffle(snapshot.shuffle);
      else await options.localPlayer.setShuffle(snapshot.shuffle);
    } catch (error) {
      options.showNotice(error instanceof Error ? `셔플 설정을 적용하지 못했습니다: ${error.message}` : "셔플 설정을 적용하지 못했습니다.");
    }
  }

  async function cycleRepeat(): Promise<void> {
    const current = options.current();
    const snapshot = options.snapshot();
    snapshot.repeat = snapshot.repeat === "off" ? "all" : snapshot.repeat === "all" ? "one" : "off";
    options.setRestoreState({ ...options.restoreState(), repeat: snapshot.repeat });
    options.persistPlayback();
    options.render();
    try {
      if (current?.source === "spotify") await options.spotifyPlayer.repeat(snapshot.repeat);
      else await options.localPlayer.setRepeat(snapshot.repeat);
    } catch (error) {
      options.showNotice(error instanceof Error ? `반복 설정을 적용하지 못했습니다: ${error.message}` : "반복 설정을 적용하지 못했습니다.");
    }
  }

  return { seek, setVolume, toggleMute, nextTrack, previousTrack, toggleShuffle, cycleRepeat };
}

export function resolvePlaybackIntent(intent: { playing: boolean; expiresAt: number } | null, reportedPlaying: boolean, now = Date.now()): { playing: boolean; intent: { playing: boolean; expiresAt: number } | null } {
  if (!intent || now >= intent.expiresAt) return { playing: reportedPlaying, intent: null };
  if (reportedPlaying === intent.playing) return { playing: reportedPlaying, intent: null };
  return { playing: intent.playing, intent };
}
