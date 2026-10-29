import type { Track } from "../../types";
import { renderTopSearchResults } from "./renderers";

interface SpotifySearchDropdownOptions {
  app: HTMLElement;
  query: () => string;
  isOpen: () => boolean;
  connected: () => boolean;
  loading: () => boolean;
  tracks: () => Track[];
  targetTrackId: () => string | null;
  playlists: () => { id: string; name: string; images?: { url: string }[] }[];
  selectedPlaylistId: () => string | null;
  artMarkup: (track: Track, size: "hero" | "mini") => string;
  icon: (name: string) => string;
}

export function createSpotifySearchDropdown(options: SpotifySearchDropdownOptions) {
  function render(): string {
    return renderTopSearchResults({
      query: options.query(),
      connected: options.connected(),
      loading: options.loading(),
      tracks: options.tracks(),
      targetTrackId: options.targetTrackId(),
      playlists: options.playlists(),
      selectedPlaylistId: options.selectedPlaylistId(),
      artMarkup: options.artMarkup,
      icon: options.icon,
    });
  }

  function paint(): void {
    const wrap = options.app.querySelector<HTMLElement>(".top-search-wrap");
    if (!wrap) return;
    const open = options.isOpen();
    wrap.classList.toggle("open", open);
    const existing = wrap.querySelector<HTMLElement>(".top-search-dropdown");
    if (!open) { existing?.remove(); return; }
    const markup = render();
    if (existing) existing.outerHTML = markup;
    else wrap.insertAdjacentHTML("beforeend", markup);
  }

  return { render, paint };
}
