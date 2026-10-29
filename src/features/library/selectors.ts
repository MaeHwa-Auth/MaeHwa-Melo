import type { Track } from "../../types";

interface LibrarySelectionState {
  page: import("../../types").AppPage;
  selectedPlaylistId: string | null;
  selectedPlaylistTracks: Track[];
  favoritesOnly: boolean;
  filter: "all" | "local" | "spotify";
}

export function getFavoriteTracks(groups: Track[][], favoriteIds: string[], mergeTracks: (...groups: Track[][]) => Track[]): Track[] {
  return mergeTracks(...groups).filter((track) => favoriteIds.includes(track.id));
}

export function getActiveTracks(state: LibrarySelectionState, tracks: Track[], favorites: Track[]): Track[] {
  if (state.page === "library" && state.selectedPlaylistId) return state.selectedPlaylistTracks;
  if (state.page === "library" && state.favoritesOnly) return favorites;
  if (state.page === "library" && state.filter === "local") return tracks.filter((track) => track.source === "local");
  if (state.page === "library" && state.filter === "spotify") return tracks.filter((track) => track.source === "spotify");
  if (state.page === "library") return tracks;
  return tracks.filter((track) => track.source === "local").slice(0, 8);
}

export function createLibraryTrackSelectors(options: {
  groups: () => Track[][];
  favoriteIds: () => string[];
  mergeTracks: (...groups: Track[][]) => Track[];
  selectionState: () => LibrarySelectionState;
  tracks: () => Track[];
}) {
  function favoriteTrackList(): Track[] {
    return getFavoriteTracks(options.groups(), options.favoriteIds(), options.mergeTracks);
  }

  function activeTracks(): Track[] {
    return getActiveTracks(options.selectionState(), options.tracks(), favoriteTrackList());
  }

  return { favoriteTrackList, activeTracks };
}
