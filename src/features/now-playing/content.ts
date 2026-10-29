import type { Track } from "../../types";
import type { TrackLyrics } from "../../services/lrclib";
import { renderLyricsCard, renderNowPlayingPanel } from "./renderers";

interface NowPlayingContentOptions {
  app: HTMLElement;
  current: () => Track | null;
  currentTrackId: () => string | undefined;
  lyricsTrackId: () => string;
  lyrics: () => TrackLyrics | null;
  lyricsLoading: () => boolean;
  lyricsError: () => boolean;
  lyricsWordMode: () => boolean;
  playlistName: () => string;
  queue: () => Track[];
  favoriteIds: () => string[];
  lyricsEnabled: () => boolean;
  artMarkup: (track: Track, size: "hero" | "mini") => string;
  artistLabel: (track: Pick<Track, "artist" | "source">) => string;
  icon: (name: string) => string;
  toggleFavorite: (id: string) => void;
  updateSyncedLyrics: () => void;
}

export function createNowPlayingContent(options: NowPlayingContentOptions) {
  function renderLyrics(): string {
    return renderLyricsCard({ currentTrackId: options.currentTrackId(), lyricsTrackId: options.lyricsTrackId(), lyrics: options.lyrics(), loading: options.lyricsLoading(), error: options.lyricsError(), wordMode: options.lyricsWordMode() });
  }

  function renderPanel(): string {
    const current = options.current();
    const upcoming = options.queue().filter((track) => track.id !== current?.id).slice(0, 1);
    return renderNowPlayingPanel({ current, playlistName: options.playlistName(), upcoming, favoriteIds: options.favoriteIds(), lyricsEnabled: options.lyricsEnabled(), renderLyrics, artMarkup: options.artMarkup, artistLabel: options.artistLabel, icon: options.icon });
  }

  function refreshPanel(): void {
    const current = options.current();
    const template = document.createElement("template");
    template.innerHTML = renderPanel();
    const replacement = template.content.firstElementChild;
    const panel = options.app.querySelector<HTMLElement>(".now-playing-panel:not(.queue-drawer)");
    if (panel && replacement) panel.replaceWith(replacement);
    options.app.querySelector<HTMLElement>(".now-playing-panel [data-like]")?.addEventListener("click", () => { if (current) options.toggleFavorite(current.id); });
    options.updateSyncedLyrics();
  }

  return { renderPanel, renderLyrics, refreshPanel };
}
