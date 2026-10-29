import type { Track } from "../../types";

interface PlaybackEventsOptions {
  app: HTMLElement;
  current: () => Track | null;
  firstTrack: () => Track | undefined;
  toggleFavorite: (id: string) => void;
  togglePlay: () => void;
  playTrack: (track: Track) => void;
  addFolder: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  openQueue: () => void;
  render: () => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

export function bindPlaybackEvents(options: PlaybackEventsOptions): void {
  if (options.app.dataset.playbackDelegationBound === "true") return;
  options.app.dataset.playbackDelegationBound = "true";
  options.app.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const control = target.closest<HTMLElement>("[data-like-id], .player-bar [data-like], [data-play], [data-hero-play], [data-next], [data-previous], [data-shuffle], [data-repeat], [data-mute]");
    if (!control) return;
    if (control.matches("[data-like-id]")) {
      event.stopPropagation();
      if (control.dataset.likeId) options.toggleFavorite(control.dataset.likeId);
    } else if (control.matches(".player-bar [data-like]")) {
      const current = options.current();
      if (current) options.toggleFavorite(current.id);
    } else if (control.matches("[data-hero-play]")) {
      const current = options.current();
      if (current) options.togglePlay();
      else { const first = options.firstTrack(); if (first) options.playTrack(first); else options.addFolder(); }
    } else if (control.matches("[data-play]")) options.togglePlay();
    else if (control.matches("[data-next]")) options.nextTrack();
    else if (control.matches("[data-previous]")) options.previousTrack();
    else if (control.matches("[data-shuffle]")) options.toggleShuffle();
    else if (control.matches("[data-repeat]")) options.cycleRepeat();
    else if (control.matches("[data-mute]")) options.toggleMute();
  });
  options.app.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.matches("[data-seek]")) options.seek(Number(target.value));
    else if (target.matches("[data-volume]")) options.setVolume(Number(target.value));
  });
}
