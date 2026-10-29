import type { Track } from "../../types";

interface FavoriteOptions {
  app: HTMLElement;
  current: Track | null;
  tracks: Track[];
  favoriteTracks: Track[];
  librarySearchTracks: Track[];
  topSearchTracks: Track[];
  playQueue: Track[];
  favoriteIds: string[];
  favoritesOnly: boolean;
  favoriteTrackList: () => Track[];
  mergeTracks: (...groups: Track[][]) => Track[];
  setFavoriteIds: (ids: string[]) => void;
  setFavoriteTracks: (tracks: Track[]) => void;
  saveFavorites: (ids: string[]) => void;
  saveFavoriteTracks: (tracks: Track[]) => void;
  icon: (name: string) => string;
  render: () => void;
}

export async function toggleFavorite(id: string, options: FavoriteOptions): Promise<void> {
  const { app, current, tracks, favoriteTracks, librarySearchTracks, topSearchTracks, playQueue, favoriteIds, favoritesOnly, favoriteTrackList, mergeTracks, setFavoriteIds, setFavoriteTracks, saveFavorites, saveFavoriteTracks, icon, render } = options;
  const track = [current, ...tracks, ...favoriteTracks, ...librarySearchTracks, ...topSearchTracks, ...playQueue].find((item): item is Track => Boolean(item && item.id === id));
  const wasLiked = favoriteIds.includes(id);
  const nextFavoriteIds = wasLiked ? favoriteIds.filter((item) => item !== id) : [...favoriteIds, id];
  let nextFavoriteTracks = wasLiked ? favoriteTracks.filter((item) => item.id !== id) : favoriteTracks;
  if (!wasLiked && track) nextFavoriteTracks = mergeTracks(nextFavoriteTracks, [track]);
  setFavoriteIds(nextFavoriteIds);
  setFavoriteTracks(nextFavoriteTracks);
  saveFavorites(nextFavoriteIds);
  saveFavoriteTracks(nextFavoriteTracks);

  const liked = !wasLiked;
  app.querySelectorAll<HTMLElement>("[data-like-id]").forEach((button) => {
    if (button.dataset.likeId !== id) return;
    button.classList.toggle("liked", liked);
    button.innerHTML = icon(liked ? "heart-filled" : "heart");
    button.setAttribute("aria-pressed", String(liked));
  });
  app.querySelectorAll<HTMLButtonElement>("[data-like]").forEach((button) => {
    if (button.closest(".now-playing-panel, .player-bar") && current?.id === id) {
      button.classList.toggle("liked", liked);
      button.innerHTML = icon(liked ? "heart-filled" : "heart");
      button.setAttribute("aria-pressed", String(liked));
    }
  });
  const favoriteCount = app.querySelector<HTMLElement>("[data-favorites] .nav-count");
  if (favoriteCount) favoriteCount.textContent = String(favoriteTrackList().length || "");
  if (favoritesOnly && wasLiked) {
    const row = app.querySelector<HTMLElement>(`.track-row[data-track="${CSS.escape(id)}"]`);
    row?.remove();
    const count = app.querySelector<HTMLElement>(".heading-count");
    if (count) count.textContent = String(Math.max(0, Number(count.textContent) - 1));
    if (!app.querySelector(".track-row")) render();
  }
}
