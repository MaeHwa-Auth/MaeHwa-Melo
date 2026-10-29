import type { Track } from "../../types";
import { esc, safeUrl } from "../../utils/format";

interface SpotifyPlaylistSummary {
  id: string;
  name: string;
  description?: string;
  owner?: { display_name?: string };
  images?: { url: string }[];
}

interface LibraryPageOptions {
  visibleTracks: Track[];
  items: Track[];
  favoriteIds: string[];
  playlistCount: number;
  albumCount: number;
  favoritesOnly: boolean;
  selectedPlaylistId: string | null;
  selectedPlaylistTracks: Track[];
  filter: "all" | "local" | "spotify";
  view: "tracks" | "albums";
  current: Track | null;
  spotifyConnected: boolean;
  playlists: SpotifyPlaylistSummary[];
  albumGroupingKey: (track: Track) => string;
  renderPlaylistHeader: (cover: string, eyebrow: string, title: string, metadata: string, description?: string) => string;
  renderToolbar: (placeholder: string, inputId: string, showSort: boolean) => string;
  renderTrackTable: (items: Track[]) => string;
  renderAlbumGrid: (items: Track[]) => string;
  renderEmpty: (message: string, showFolderAction: boolean, heading: string) => string;
  icon: (name: string) => string;
}

export function renderLibraryPage(options: LibraryPageOptions): string {
  const { visibleTracks, items, favoriteIds, playlistCount, albumCount, favoritesOnly, selectedPlaylistId, selectedPlaylistTracks, filter, view, current, spotifyConnected, playlists, renderPlaylistHeader, renderToolbar, renderTrackTable, renderAlbumGrid, renderEmpty, icon } = options;
  const activePlaylist = playlists.find((playlist) => playlist.id === selectedPlaylistId);
  const activePlaylistName = selectedPlaylistId === "liked-songs"
    ? "좋아요 표시한 곡"
    : activePlaylist?.name ?? (filter === "local" ? "로컬 음악" : filter === "spotify" ? "Spotify" : "전체");
  const emptyMessage = selectedPlaylistId === "liked-songs" ? "Spotify에서 좋아요 표시를 한 곡이 여기에 표시됩니다." : selectedPlaylistId ? "이 플레이리스트는 아직 비어 있습니다. 상단 검색에서 곡을 찾아 + 버튼으로 추가하세요." : favoritesOnly ? favoriteIds.length ? "저장된 즐겨찾기 ID는 있지만 곡 정보를 찾을 수 없습니다. 곡을 다시 찾아 하트를 누르면 목록에 저장됩니다." : "하트 버튼을 눌러 좋아하는 곡을 모아보세요." : filter === "spotify" ? spotifyConnected ? "Spotify에 저장한 곡이 없습니다." : "Spotify 계정을 연결하면 저장한 곡이 여기에 표시됩니다." : "폴더를 추가해 음악을 불러오세요.";
  const showFolderAction = !selectedPlaylistId && filter !== "spotify" && !favoritesOnly;
  const showMetadataRepair = !selectedPlaylistId && filter === "local" && !favoritesOnly;
  const selectedPlaylistDuration = selectedPlaylistTracks.reduce((sum, track) => sum + (track.duration ?? 0), 0);
  const selectedPlaylistDurationLabel = selectedPlaylistDuration >= 3600 ? `${Math.floor(selectedPlaylistDuration / 3600)}시간 ${Math.floor(selectedPlaylistDuration % 3600 / 60)}분` : `${Math.floor(selectedPlaylistDuration / 60)}분`;
  const playlistHeader = selectedPlaylistId && selectedPlaylistId !== "liked-songs" && activePlaylist
    ? renderPlaylistHeader(`<img class="playlist-page-cover playlist-cover-enlarge" data-playlist-cover-enlarge data-cover-artwork="${esc(safeUrl(activePlaylist.images?.[0]?.url ?? ""))}" data-cover-title="${esc(activePlaylist.name)}" role="button" tabindex="0" aria-label="${esc(activePlaylist.name)} 플레이리스트 커버 크게 보기" src="${esc(safeUrl(activePlaylist.images?.[0]?.url))}" alt="">`, "Spotify 플레이리스트", activePlaylist.name, `${esc(activePlaylist.owner?.display_name ?? "Spotify 사용자")} <span>·</span> ${items.length}곡 <span>·</span> 총 재생 시간 ${selectedPlaylistDurationLabel}`, activePlaylist.description ?? "")
    : `<div class="page-heading"><div><span class="eyebrow">${selectedPlaylistId ? "Spotify 플레이리스트" : "음악 모음"}</span><h1>${favoritesOnly ? "즐겨찾기" : esc(activePlaylistName)}${selectedPlaylistId ? "" : `<span class="heading-count">${items.length}</span>`}</h1><p>음악 ${playlistCount}곡 · 앨범 ${albumCount}개</p></div><div class="library-heading-actions">${showMetadataRepair ? `<button class="secondary-button metadata-repair-trigger" data-metadata-repair ${current?.source !== "local" || !current.localPath || current.localPath.startsWith("blob:") ? 'disabled title="로컬 곡을 재생하면 보완할 수 있습니다"' : ""}>${icon("refresh")} 메타데이터 보완</button>` : ""}${showFolderAction ? `<button class="add-folder-button" data-add-folder>${icon("plus")} 폴더 추가</button>` : ""}</div></div>`;
  const stickyPlaylistCover = activePlaylist?.images?.[0]?.url
    ? `<div class="playlist-sticky-cover" data-playlist-sticky-cover data-playlist-cover-url="${esc(safeUrl(activePlaylist.images[0].url))}" aria-hidden="true"><div class="playlist-sticky-cover-art"></div></div>`
    : "";
  const list = items.length ? view === "tracks" ? renderTrackTable(items) : renderAlbumGrid(items) : renderEmpty(emptyMessage, showFolderAction, selectedPlaylistId ? "플레이리스트가 비어 있습니다" : favoritesOnly ? "즐겨찾기가 비어 있습니다" : "라이브러리가 비어 있습니다");
  return `${stickyPlaylistCover}${playlistHeader}${renderToolbar("라이브러리 필터", "library-search", filter === "spotify" && !favoritesOnly)}${list}`;
}
