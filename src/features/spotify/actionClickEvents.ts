interface SpotifyActionClickOptions {
  app: HTMLElement;
  selectedPlaylistId: () => string | null;
  addSearchTrack: (trackId: string, playlistId: string) => void;
  targetTrackId: () => string | null;
  setTargetTrackId: (trackId: string | null) => void;
  openPlaylistDialog: () => void;
  playlistBusy: () => boolean;
  closePlaylistDialog: () => void;
  searchOpen: () => boolean;
  setSearchOpen: (open: boolean) => void;
  paintSearch: () => void;
  visibilityOpen: () => boolean;
  closeVisibility: () => void;
  sortOpen: () => boolean;
  closeSort: () => void;
  playSearchResult: (index: number) => void;
}

export function handleSpotifyActionClick(target: HTMLElement, options: SpotifyActionClickOptions): boolean {
  const addButton = target.closest<HTMLElement>("[data-search-add]");
  if (addButton) {
    const trackId = addButton.dataset.searchAdd!;
    const playlistId = options.selectedPlaylistId();
    if (playlistId) options.addSearchTrack(trackId, playlistId);
    else options.setTargetTrackId(trackId);
    return true;
  }
  const destination = target.closest<HTMLElement>("[data-add-target]");
  const targetTrackId = options.targetTrackId();
  if (destination && targetTrackId) { options.addSearchTrack(targetTrackId, destination.dataset.addTarget!); return true; }
  if (target.closest("[data-create-playlist]")) {
    if (!target.closest(".search-playlist-targets")) options.setTargetTrackId(null);
    options.openPlaylistDialog();
    window.setTimeout(() => options.app.querySelector<HTMLInputElement>("#playlist-name")?.focus(), 0);
    return true;
  }
  if (target.closest("[data-playlist-cancel]") || target.matches("[data-playlist-backdrop]")) {
    if (!options.playlistBusy()) options.closePlaylistDialog();
    return true;
  }
  if (target.closest(".playlist-modal")) {
    if (options.searchOpen()) { options.setSearchOpen(false); options.paintSearch(); }
    if (options.visibilityOpen() && !target.closest(".visibility-select")) options.closeVisibility();
    return true;
  }
  if (options.sortOpen() && !target.closest(".library-sort")) options.closeSort();
  const searchResult = target.closest<HTMLElement>("[data-search-track]");
  if (searchResult) { options.playSearchResult(Number(searchResult.dataset.searchIndex)); return true; }
  if (!options.searchOpen() || target.closest(".top-search-wrap")) return true;
  options.setSearchOpen(false);
  options.paintSearch();
  return true;
}
