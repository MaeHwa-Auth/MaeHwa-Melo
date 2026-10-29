import type { Track } from "../../types";
import type { SpotifySavedAlbum, SpotifyTopArtist } from "../../services/spotify";
import { esc } from "../../utils/format";

export type LibrarySortMode = "default" | "newest" | "oldest" | "duration-asc" | "duration-desc";

interface PlaylistSummary {
  id: string;
  name: string;
  owner?: { display_name?: string };
  images?: { url: string }[];
}

export function renderSpotifySidebarPlaylists(options: {
  page: string;
  filter: "all" | "local" | "spotify";
  favoritesOnly: boolean;
  connected: boolean;
  selectedPlaylistId: string | null;
  playlists: PlaylistSummary[];
  followingArtists: SpotifyTopArtist[];
  savedAlbums: SpotifySavedAlbum[];
  icon: (name: string) => string;
}): string {
  const { page, filter, favoritesOnly, connected, selectedPlaylistId, playlists, followingArtists, savedAlbums, icon } = options;
  if (page !== "library" || (filter !== "spotify" && filter !== "all") || favoritesOnly) return "";
  const heading = `<div class="spotify-playlist-divider"></div>`;
  if (!connected) return `<div class="spotify-playlist-section">${heading}<section class="spotify-sidebar-playlists"><p>Spotify를 연결하면 목록이 표시됩니다.</p></section></div>`;
  return `<div class="spotify-playlist-section">${heading}<section class="spotify-sidebar-playlists" aria-label="Spotify 라이브러리"><div class="spotify-sidebar-group"><span class="side-label">플레이리스트</span><button class="spotify-sidebar-playlist ${selectedPlaylistId === "liked-songs" ? "selected" : ""}" data-playlist="liked-songs" aria-label="좋아요 표시한 곡" data-tooltip-subtitle="Spotify 플레이리스트"><span class="spotify-sidebar-playlist-art liked-songs-placeholder">${icon("heart-filled")}</span><span>좋아요 표시한 곡</span></button>${playlists.map((playlist) => `<div class="spotify-sidebar-playlist ${selectedPlaylistId === playlist.id ? "selected" : ""}" data-tooltip-title="${esc(playlist.name)}" data-tooltip-subtitle="플레이리스트 · ${esc(playlist.owner?.display_name ?? "Spotify")}"><button class="spotify-sidebar-playlist-cover" type="button" data-playlist-cover-enlarge data-cover-artwork="${esc(playlist.images?.[0]?.url ?? "")}" data-cover-title="${esc(playlist.name)}" aria-label="${esc(playlist.name)} 커버 크게 보기">${playlist.images?.[0]?.url ? `<img src="${esc(playlist.images[0].url)}" alt="">` : icon("music")}</button><button class="spotify-sidebar-playlist-open" type="button" data-playlist="${esc(playlist.id)}" aria-label="${esc(playlist.name)}" data-tooltip-subtitle="플레이리스트 열기"><span>${esc(playlist.name)}</span></button></div>`).join("")}<button class="spotify-sidebar-playlist create" data-create-playlist aria-label="새 플레이리스트">${icon("plus")}<span>새 플레이리스트</span></button></div><div class="spotify-sidebar-group"><span class="side-label">팔로우 아티스트</span>${followingArtists.length ? followingArtists.map((artist) => `<button class="spotify-sidebar-library-item" type="button" data-open-artist="${esc(artist.name)}" data-open-artist-id="${esc(artist.id)}" title="${esc(artist.name)}"><span class="spotify-sidebar-library-art round">${artist.image ? `<img src="${esc(artist.image)}" alt="">` : icon("music")}</span><span>${esc(artist.name)}</span></button>`).join("") : `<p>팔로우한 아티스트가 없습니다.</p>`}</div><div class="spotify-sidebar-group"><span class="side-label">저장한 앨범</span>${savedAlbums.length ? savedAlbums.map((album) => `<button class="spotify-sidebar-library-item" type="button" data-open-saved-album="${esc(album.id)}" title="${esc(album.name)}"><span class="spotify-sidebar-library-art">${album.image ? `<img src="${esc(album.image)}" alt="">` : icon("album")}</span><span><b>${esc(album.name)}</b><small>${esc(album.artists.join(", "))}</small></span></button>`).join("") : `<p>저장한 앨범이 없습니다.</p>`}</div></section></div>`;
}

export function renderLibrarySort(mode: LibrarySortMode, open: boolean, icon: (name: string) => string): string {
  const options: [LibrarySortMode, string][] = [
    ["default", "플레이리스트 순서"],
    ["newest", "최신 추가순"],
    ["oldest", "오래된 추가순"],
    ["duration-asc", "재생 시간 짧은 순"],
    ["duration-desc", "재생 시간 긴 순"],
  ];
  const selectedLabel = options.find(([itemMode]) => itemMode === mode)?.[1] ?? options[0][1];
  return `<div class="library-sort"><button class="library-sort-trigger" data-sort-toggle aria-haspopup="listbox" aria-expanded="${open}">${icon("sort")}<span>${esc(selectedLabel)}</span>${icon("chevron")}</button>${open ? `<div class="library-sort-menu" role="listbox" aria-label="곡 정렬">${options.map(([itemMode, label]) => `<button type="button" role="option" aria-selected="${mode === itemMode}" data-sort-mode="${itemMode}"><span>${label}</span>${mode === itemMode ? icon("check") : ""}</button>`).join("")}</div>` : ""}</div>`;
}

export function renderLibraryToolbar(options: {
  placeholder: string;
  inputId: string;
  value: string;
  showSort: boolean;
  sortMode: LibrarySortMode;
  sortOpen: boolean;
  view: "tracks" | "albums";
  icon: (name: string) => string;
}): string {
  const { placeholder, inputId, value, showSort, sortMode, sortOpen, view, icon } = options;
  const viewLabel = view === "tracks" ? "앨범" : "곡";
  return `<div class="library-toolbar"><label class="library-search">${icon("search")}<input id="${inputId}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" aria-label="${esc(placeholder)}"></label>${showSort ? renderLibrarySort(sortMode, sortOpen, icon) : ""}<button class="view-mode" data-view-mode title="${viewLabel} 보기" aria-label="${viewLabel} 보기">${icon(view === "tracks" ? "album" : "library")} ${viewLabel}</button></div>`;
}

export function sortLibraryTracks(items: Track[], enabled: boolean, mode: LibrarySortMode): Track[] {
  if (!enabled || mode === "default") return [...items];
  return items.map((track, index) => ({ track, index })).sort((left, right) => {
    const a = left.track;
    const b = right.track;
    if (mode === "newest" || mode === "oldest") {
      const aDate = a.addedAt ? Date.parse(a.addedAt) : Number.NaN;
      const bDate = b.addedAt ? Date.parse(b.addedAt) : Number.NaN;
      const aValid = Number.isFinite(aDate);
      const bValid = Number.isFinite(bDate);
      if (aValid !== bValid) return aValid ? -1 : 1;
      if (aValid && bValid && aDate !== bDate) return mode === "newest" ? bDate - aDate : aDate - bDate;
    } else {
      const aDuration = a.duration;
      const bDuration = b.duration;
      if (aDuration !== undefined && bDuration === undefined) return -1;
      if (aDuration === undefined && bDuration !== undefined) return 1;
      if (aDuration !== undefined && bDuration !== undefined && aDuration !== bDuration) return mode === "duration-asc" ? aDuration - bDuration : bDuration - aDuration;
    }
    return left.index - right.index;
  }).map(({ track }) => track);
}
