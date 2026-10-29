import type { Track } from "../../types";
import type { LibrarySortMode } from "./controls";
import { albumGroupingKey } from "./albumGrouping";

type Page = import("../../types").AppPage;
type Filter = "all" | "local" | "spotify";

interface LibraryPageEventsOptions {
  app: HTMLElement;
  getPage: () => Page;
  setPage: (page: Page) => void;
  closeTopSearch: () => void;
  setFilter: (filter: Filter) => void;
  setFavoritesOnly: (value: boolean) => void;
  clearPlaylistSelection: () => void;
  loadPlaylist: (id: string, selected: boolean, preserveScroll: boolean, autoScroll: boolean) => void;
  current: () => Track | null;
  render: () => void;
  scrollToCurrentTrack: () => void;
  setSortMode: (mode: LibrarySortMode) => void;
  sortOpen: () => boolean;
  setSortOpen: (open: boolean) => void;
  visibilityOpen: () => boolean;
  setVisibilityOpen: (open: boolean) => void;
  setPlaylistDraftPublic: (value: boolean) => void;
  playlistDraftPublic: () => boolean;
  setPlaylistDraftName: (value: string) => void;
  createPlaylist: (name: string, isPublic: boolean) => void;
  libraryView: () => "tracks" | "albums";
  setLibraryView: (view: "tracks" | "albums") => void;
  albumView: () => { tracks: Track[]; name: string } | null;
  albumReturnPage: () => Page;
  artistReturnPage: () => Page;
  activeTracks: () => Track[];
  filter: () => Filter;
  selectedPlaylistId: () => string | null;
  selectedPlaylistTracks: () => Track[];
  favoritesOnly: () => boolean;
  tracks: () => Track[];
  favoriteTracks: () => Track[];
  librarySearchTracks: () => Track[];
  recentTracks: () => Track[];
  sortLibraryTracks: (tracks: Track[], enabled: boolean) => Track[];
  mergeTracks: (left: Track[], right: Track[]) => Track[];
  showNotice: (message: string) => void;
  playTrack: (track: Track, queue: Track[], context?: string) => void;
  togglePlay: () => void;
  openFavorites: () => void;
}

export function bindLibraryPageEvents(options: LibraryPageEventsOptions): void {
  options.app.querySelector<HTMLElement>("[data-favorites]")?.addEventListener("click", options.openFavorites);
  options.app.querySelectorAll<HTMLElement>("[data-page]").forEach((element) => element.addEventListener("click", () => {
    options.closeTopSearch();
    options.setPage(element.dataset.page as Page);
    options.setFavoritesOnly(false);
    if (element.dataset.filter) {
      options.setFilter(element.dataset.filter as Filter);
      options.clearPlaylistSelection();
    } else if (options.getPage() === "library") {
      options.setFilter("all");
      options.clearPlaylistSelection();
    }
    options.render();
    if (options.getPage() === "library") options.scrollToCurrentTrack();
  }));
  options.app.querySelector<HTMLElement>("[data-sort-toggle]")?.addEventListener("click", () => { options.setSortOpen(!options.sortOpen()); options.render(); });
  options.app.querySelectorAll<HTMLButtonElement>("[data-sort-mode]").forEach((element) => element.addEventListener("click", () => { options.setSortMode(element.dataset.sortMode as LibrarySortMode); options.setSortOpen(false); options.render(); }));
  options.app.querySelectorAll<HTMLElement>("[data-playlist]").forEach((element) => element.addEventListener("click", () => void options.loadPlaylist(element.dataset.playlist!, true, true, true)));
  options.app.querySelector<HTMLButtonElement>("[data-visibility-toggle]")?.addEventListener("click", () => { options.setVisibilityOpen(!options.visibilityOpen()); options.render(); if (options.visibilityOpen()) window.setTimeout(() => options.app.querySelector<HTMLElement>("[data-visibility-option][aria-selected=true]")?.focus(), 0); });
  options.app.querySelectorAll<HTMLButtonElement>("[data-visibility-option]").forEach((option, index, allOptions) => {
    option.addEventListener("click", () => { options.setPlaylistDraftPublic(option.dataset.visibilityOption === "public"); options.setVisibilityOpen(false); options.render(); window.setTimeout(() => options.app.querySelector<HTMLButtonElement>("[data-visibility-toggle]")?.focus(), 0); });
    option.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { options.setVisibilityOpen(false); options.render(); options.app.querySelector<HTMLButtonElement>("[data-visibility-toggle]")?.focus(); }
      else if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); allOptions[(index + (event.key === "ArrowDown" ? 1 : allOptions.length - 1)) % allOptions.length]?.focus(); }
    });
  });
  options.app.querySelector<HTMLFormElement>("[data-playlist-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const name = formData.get("name")?.toString().trim() ?? "";
    options.setPlaylistDraftName(name);
    if (name) options.createPlaylist(name, options.playlistDraftPublic());
  });
  options.app.querySelector<HTMLElement>("[data-view-mode]")?.addEventListener("click", () => { options.setLibraryView(options.libraryView() === "tracks" ? "albums" : "tracks"); options.render(); });
  options.app.querySelectorAll<HTMLElement>("[data-album]").forEach((element) => element.addEventListener("click", (event) => {
    const albumKey = decodeURIComponent(element.dataset.album ?? "");
    const album = options.albumView();
    const albumTracks = (options.getPage() === "album" && album ? album.tracks : options.activeTracks()).filter((track) => albumGroupingKey(track) === albumKey).sort((a, b) => (a.discNumber ?? 1) - (b.discNumber ?? 1) || (a.trackNumber ?? 0) - (b.trackNumber ?? 0));
    const currentId = options.current()?.id;
    if ((event.target as HTMLElement).closest("[data-album-play]") && currentId && albumTracks.some((track) => track.id === currentId)) { event.preventDefault(); event.stopPropagation(); options.togglePlay(); return; }
    if (albumTracks[0]) options.playTrack(albumTracks[0], albumTracks, albumTracks[0].album || albumTracks[0].title);
  }));
  options.app.querySelector<HTMLElement>("[data-album-back]")?.addEventListener("click", () => { options.setPage(options.albumReturnPage()); options.render(); });
  options.app.querySelector<HTMLElement>("[data-artist-back]")?.addEventListener("click", () => { options.setPage(options.artistReturnPage()); options.render(); });
  options.app.querySelector<HTMLElement>("[data-play-album]")?.addEventListener("click", () => { const album = options.albumView(); if (album?.tracks[0]) options.playTrack(album.tracks[0], album.tracks, album.name); });
  options.app.querySelectorAll<HTMLElement>("[data-track]").forEach((element) => element.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("[data-like-id]")) return;
    const trackId = element.dataset.track;
    const album = options.albumView();
    const track = album?.tracks.find((item) => item.id === trackId)
      ?? options.selectedPlaylistTracks().find((item) => item.id === trackId)
      ?? options.tracks().find((item) => item.id === trackId)
      ?? options.favoriteTracks().find((item) => item.id === trackId)
      ?? options.librarySearchTracks().find((item) => item.id === trackId);
    const tracks = options.tracks();
    const libraryQueue = options.selectedPlaylistId() || options.favoritesOnly() ? options.activeTracks() : options.mergeTracks(options.filter() === "all" ? tracks : tracks.filter((item) => item.source === options.filter()), options.librarySearchTracks());
    const queue = options.getPage() === "album" && album ? album.tracks : options.getPage() === "library" ? options.sortLibraryTracks(libraryQueue, options.filter() === "spotify") : options.getPage() === "home" ? options.recentTracks() : options.activeTracks();
    if (track?.available === false) { options.showNotice("파일을 찾을 수 없습니다. 설정에서 음악 폴더를 갱신해 주세요."); return; }
    if (track) options.playTrack(track, queue, options.getPage() === "album" ? album?.name : undefined);
  }));
  options.app.querySelectorAll<HTMLElement>("[data-row-play]").forEach((element) => element.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const row = element.closest<HTMLButtonElement>(".track-row");
    const trackId = row?.dataset.track;
    if (!row || !trackId) return;
    if (options.current()?.id === trackId) options.togglePlay();
    else row.click();
  }));
}
