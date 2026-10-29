import type { PlaybackSnapshot, Track } from "../../types";

interface PlaybackUiOptions {
  app: HTMLElement;
  current: Track | null;
  snapshot: PlaybackSnapshot;
  icon: (name: string) => string;
  albumPlaybackStatus: (playing: boolean) => string;
}

export function patchAlbumCardPlaybackState(options: PlaybackUiOptions): void {
  options.app.querySelectorAll<HTMLButtonElement>(".album-card[data-album]").forEach((card) => {
    const albumTrackIds = JSON.parse(decodeURIComponent(card.dataset.albumTrackIds ?? "%5B%5D")) as string[];
    const isCurrentAlbum = Boolean(options.current && albumTrackIds.includes(options.current.id));
    const isPlayingAlbum = isCurrentAlbum && options.snapshot.playing;
    card.classList.toggle("is-current", isCurrentAlbum);
    card.classList.toggle("is-playing", isPlayingAlbum);
    const status = card.querySelector<HTMLElement>(".album-play");
    if (status) {
      if (status.dataset.playing !== String(isPlayingAlbum)) {
        status.innerHTML = options.albumPlaybackStatus(isPlayingAlbum);
        status.dataset.playing = String(isPlayingAlbum);
      }
      status.title = isPlayingAlbum ? "일시정지" : "재생";
      status.setAttribute("aria-label", `${card.querySelector<HTMLElement>("strong")?.textContent ?? "앨범"} ${isPlayingAlbum ? "일시정지" : "재생"}`);
    }
  });
}

export function patchTrackRowPlaybackState(options: PlaybackUiOptions): void {
  options.app.querySelectorAll<HTMLElement>(".track-row[data-track]").forEach((row) => {
    const isPlaying = Boolean(options.snapshot.playing && options.current && row.dataset.track === options.current.id);
    const status = row.querySelector<HTMLElement>(".row-play");
    if (status) {
      status.innerHTML = options.icon(isPlaying ? "pause" : "play");
      status.title = isPlaying ? "일시정지" : "재생";
      const title = row.querySelector<HTMLElement>(".track-identity strong")?.textContent ?? "곡";
      status.setAttribute("aria-label", `${title} ${isPlaying ? "일시정지" : "재생"}`);
    }
  });
}
