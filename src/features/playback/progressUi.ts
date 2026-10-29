import type { PlaybackSnapshot, Track } from "../../types";
import { formatTime } from "../../utils/format";

interface ProgressUiOptions {
  app: HTMLElement;
  current: Track | null;
  snapshot: PlaybackSnapshot;
  lastTrackId: () => string;
  setLastTrackId: (id: string) => void;
  icon: (name: string) => string;
  updateSyncedLyrics: () => void;
}

export function patchProgressUi(options: ProgressUiOptions): void {
  const { app, current, snapshot } = options;
  options.updateSyncedLyrics();
  const playButton = app.querySelector<HTMLButtonElement>("[data-play]");
  if (playButton) {
    const playing = snapshot.playing;
    playButton.innerHTML = options.icon(playing ? "pause" : "play");
    playButton.title = playing ? "일시정지" : "재생";
    playButton.setAttribute("aria-label", playing ? "일시정지" : "재생");
  }
  const heroPlayButton = app.querySelector<HTMLButtonElement>("[data-hero-play]");
  if (heroPlayButton && current) heroPlayButton.innerHTML = `${options.icon(snapshot.playing ? "pause" : "play")} ${snapshot.playing ? "일시정지" : "재생"}`;
  const muteButton = app.querySelector<HTMLButtonElement>("[data-mute]");
  if (muteButton) {
    const muted = snapshot.volume === 0;
    muteButton.innerHTML = options.icon(muted ? "muted" : "volume");
    muteButton.title = muted ? "음소거 해제" : "음소거";
    muteButton.setAttribute("aria-label", muteButton.title);
  }
  const volumeSlider = app.querySelector<HTMLInputElement>("[data-volume]");
  if (volumeSlider) {
    if (document.activeElement !== volumeSlider) volumeSlider.value = String(snapshot.volume);
    const volumeProgress = `${Math.min(100, Math.max(0, snapshot.volume * 100))}%`;
    if (volumeSlider.style.getPropertyValue("--progress") !== volumeProgress) volumeSlider.style.setProperty("--progress", volumeProgress);
  }
  const progress = app.querySelector<HTMLInputElement>("[data-seek]");
  if (progress) {
    const nextMax = String(Math.max(snapshot.duration, 1));
    if (progress.max !== nextMax) progress.max = nextMax;
    const trackChanged = options.lastTrackId() !== (current?.id ?? "");
    if (document.activeElement !== progress || trackChanged) progress.value = String(Math.min(snapshot.position, snapshot.duration || 1));
    const ratio = snapshot.duration ? snapshot.position / snapshot.duration * 100 : 0;
    const progressValue = `${Math.min(100, ratio)}%`;
    if (progress.style.getPropertyValue("--progress") !== progressValue) progress.style.setProperty("--progress", progressValue);
  }
  options.setLastTrackId(current?.id ?? "");
  const labels = app.querySelectorAll<HTMLElement>(".timeline > span");
  if (labels.length === 2) {
    labels[0].textContent = formatTime(snapshot.position);
    labels[1].textContent = formatTime(snapshot.duration);
  }
}
