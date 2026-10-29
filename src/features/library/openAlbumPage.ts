import type { SpotifyAlbumDetails } from "../../services/spotify";
import type { Track } from "../../types";

type Page = import("../../types").AppPage;

interface OpenAlbumPageOptions {
  current: () => Track | null;
  page: () => Page;
  setPage: (page: Page) => void;
  albumReturnPage: () => Page;
  setAlbumReturnPage: (page: Page) => void;
  setAlbumQuery: (query: string) => void;
  setAlbum: (album: SpotifyAlbumDetails) => void;
  resolveAlbum: (track: Track) => Promise<{ album: SpotifyAlbumDetails; fallback: boolean }>;
  mainContent: () => HTMLElement | null;
  renderPage: () => string;
  setLastRenderedPage: (page: Page) => void;
  bindEvents: () => void;
  showNotice: (message: string) => void;
}

export function createOpenAlbumPage(options: OpenAlbumPageOptions): () => Promise<void> {
  async function openCurrentAlbum(): Promise<void> {
    const track = options.current();
    if (!track) return;
    options.setAlbumQuery("");
    options.setAlbumReturnPage(options.page() === "album" ? options.albumReturnPage() : options.page());
    try {
      const result = await options.resolveAlbum(track);
      options.setAlbum(result.album);
      options.setPage("album");
      const mainContent = options.mainContent();
      if (mainContent) { mainContent.innerHTML = options.renderPage(); options.setLastRenderedPage("album"); options.bindEvents(); }
      if (result.fallback) options.showNotice("Spotify 앨범 목록을 가져오지 못해 현재 곡만 표시합니다.");
    } catch {
      const fallback = (await options.resolveAlbum({ ...track, source: "local" })).album;
      fallback.name = track.album.trim() && track.album !== "Spotify" ? track.album : track.title;
      options.setAlbum(fallback);
      options.setPage("album");
      const mainContent = options.mainContent();
      if (mainContent) { mainContent.innerHTML = options.renderPage(); options.setLastRenderedPage("album"); options.bindEvents(); }
      if (fallback.tracks.length === 1) options.showNotice("Spotify 앨범 목록을 가져오지 못해 현재 곡만 표시합니다.");
    }
  }

  return openCurrentAlbum;
}
