import type { SpotifyAlbumDetails, SpotifyArtistProfile } from "../../services/spotify";
import type { Track } from "../../types";
import { esc, safeUrl } from "../../utils/format";
import { renderAlbumGrid, renderTrackTable } from "../library/renderers";
import { renderLibraryPage } from "../library/page";
import { renderLibraryToolbar as renderLibraryToolbarMarkup } from "../library/controls";
import { albumGroupingKey } from "../library/albumGrouping";
import { resolveRecentTracks } from "../library/recentTracks";
import { artistLabel, artMarkup } from "../library/trackPresentation";
import { albumPlaybackStatus } from "../library/renderers";
import { icon } from "../../ui/icons";
import { readPersonalizationPreferences } from "../../services/personalization";
import { renderAlbumPage, renderEmpty, renderHomePage, renderPlaylistHeader, renderSettingsPage } from "./renderers";
import type { LibrarySortMode } from "../library/controls";

type Page = import("../../types").AppPage;
type Filter = "all" | "local" | "spotify";

interface PageRendererOptions {
  page: () => Page;
  artist: () => string;
  artistProfile: () => SpotifyArtistProfile | null;
  artistProfileLoading: () => boolean;
  artistProfileError: () => string;
  album: () => SpotifyAlbumDetails | null;
  albumQuery: () => string;
  libraryQuery: () => string;
  libraryView: () => "tracks" | "albums";
  sortMode: () => LibrarySortMode;
  sortOpen: () => boolean;
  current: () => Track | null;
  snapshot: () => { playing: boolean };
  tracks: () => Track[];
  favoriteIds: () => string[];
  recentIds: () => string[];
  folders: () => string[];
  filter: () => Filter;
  selectedPlaylistId: () => string | null;
  selectedPlaylistTracks: () => Track[];
  favoritesOnly: () => boolean;
  playlists: () => { id: string; name: string; description?: string; owner?: { display_name?: string }; images?: { url: string }[]; tracks?: { total?: number }; public?: boolean | null }[];
  sortLibraryTracks: (items: Track[], enabled: boolean) => Track[];
  activeTracks: () => Track[];
  spotifyConnected: () => boolean;
  spotifyReady: () => boolean;
  icon: (name: string) => string;
}

export function createPageRenderer(options: PageRendererOptions) {
  const trackOptions = (compact = false) => ({ compact, currentTrackId: options.current()?.id, playing: options.snapshot().playing, favoriteIds: options.favoriteIds(), artMarkup, artistLabel, icon: options.icon });
  const albumOptions = () => ({ current: options.current(), playing: options.snapshot().playing, albumGroupingKey, albumPlaybackStatus: (playing: boolean) => albumPlaybackStatus(playing, options.icon), artMarkup, artistLabel, icon: options.icon });
  const renderToolbar = (placeholder: string, inputId: string, showSort: boolean) => renderLibraryToolbarMarkup({ placeholder, inputId, value: inputId === "album-search" ? options.albumQuery() : "", showSort, sortMode: options.sortMode(), sortOpen: options.sortOpen(), view: options.libraryView(), icon: options.icon });
  const renderEmptyState = (message = "아직 등록된 음악이 없습니다.", showFolderAction = true, heading = "라이브러리가 비어 있습니다") => renderEmpty(message, showFolderAction, heading, options.icon);
  const renderHeader = (cover: string, eyebrow: string, title: string, metadata: string, description = "") => renderPlaylistHeader(cover, eyebrow, title, metadata, description);
  const sortTracks = (items: Track[], enabled: boolean) => options.sortLibraryTracks(items, enabled);

  function renderAlbum(album: SpotifyAlbumDetails): string {
    return renderAlbumPage({ album, currentSource: options.current()?.source, query: options.albumQuery(), view: options.libraryView(), sortTracks, renderPlaylistHeader: renderHeader, renderToolbar, renderTrackTable: (items) => renderTrackTable(items, trackOptions()), renderAlbumGrid: (items) => renderAlbumGrid(items, albumOptions()), renderEmpty: renderEmptyState });
  }

  function renderLibrary(): string {
    const favoriteIds = options.favoriteIds();
    const filter = options.filter();
    const selectedPlaylistId = options.selectedPlaylistId();
    const selectedPlaylistTracks = options.selectedPlaylistTracks();
    const favoritesOnly = options.favoritesOnly();
    const tracks = options.tracks();
    const visibleTracks = favoritesOnly ? options.activeTracks() : selectedPlaylistId ? selectedPlaylistTracks : filter === "all" ? tracks : tracks.filter((track) => track.source === filter);
    const albumCount = new Set(visibleTracks.map(albumGroupingKey)).size;
    const playlistCount = visibleTracks.length;
    let items = visibleTracks;
    const query = options.libraryQuery().trim();
    if (query) { const normalized = query.toLocaleLowerCase(); items = visibleTracks.filter((track) => `${track.title} ${track.artist} ${track.album}`.toLocaleLowerCase().includes(normalized)); }
    if (favoritesOnly) items = items.filter((track) => favoriteIds.includes(track.id));
    items = sortTracks(items, filter === "spotify");
    return renderLibraryPage({ visibleTracks, items, favoriteIds, playlistCount, albumCount, favoritesOnly, selectedPlaylistId, selectedPlaylistTracks, filter, view: options.libraryView(), current: options.current(), spotifyConnected: options.spotifyConnected(), playlists: options.playlists(), albumGroupingKey, renderPlaylistHeader: renderHeader, renderToolbar, renderTrackTable: (rows) => renderTrackTable(rows, trackOptions()), renderAlbumGrid: (rows) => renderAlbumGrid(rows, albumOptions()), renderEmpty: renderEmptyState, icon: options.icon });
  }

  function renderHome(): string {
    const list = resolveRecentTracks(options.recentIds(), options.tracks());
    return renderHomePage({ recentTracks: list, current: options.current(), playing: options.snapshot().playing, artMarkup, artistLabel, icon: options.icon, renderTrackTable: (items, compact) => renderTrackTable(items, trackOptions(compact)), renderEmpty: renderEmptyState });
  }

  function renderSettings(): string {
    const tracks = options.tracks();
    return renderSettingsPage({ spotifyReady: options.spotifyReady(), spotifyConnected: options.spotifyConnected(), folders: options.folders(), localTrackCount: tracks.filter((track) => track.source === "local").length, personalization: readPersonalizationPreferences(), icon: options.icon });
  }

  function renderArtist(): string {
    const artist = options.artist();
    const profile = options.artistProfile();
    if (options.artistProfileLoading()) return `<section class="artist-detail-page"><button class="text-button artist-page-back" data-artist-back>← 뒤로</button><div class="metadata-repair-state">Spotify 아티스트 프로필을 불러오는 중…</div></section>`;
    if (options.artistProfileError()) return `<section class="artist-detail-page"><button class="text-button artist-page-back" data-artist-back>← 뒤로</button><div class="metadata-repair-state">${esc(options.artistProfileError())}</div></section>`;
    if (!profile) return `<section class="artist-detail-page"><button class="text-button artist-page-back" data-artist-back>← 뒤로</button><div class="metadata-repair-state">Spotify 아티스트 프로필이 없습니다.</div></section>`;
    const profileLink = profile.spotifyUrl ? safeUrl(profile.spotifyUrl) : "https://open.spotify.com/";
    const image = profile.image ? `<a class="spotify-artist-image-link" href="${esc(profileLink)}" target="_blank" rel="noopener noreferrer"><img class="spotify-artist-image" src="${esc(safeUrl(profile.image))}" alt="${esc(profile.name)}"></a>` : `<div class="spotify-artist-image spotify-artist-image-empty">♪</div>`;
    const stats = [profile.followers === undefined ? "" : `팔로워 ${profile.followers.toLocaleString("ko-KR")}`, profile.popularity === undefined ? "" : `인기도 ${profile.popularity}`].filter(Boolean).join(" · ");
    const albumCards = profile.albums.map((album) => `<a class="spotify-artist-album" href="${esc(safeUrl(album.spotifyUrl ?? profileLink))}" target="_blank" rel="noopener noreferrer">${album.image ? `<img src="${esc(safeUrl(album.image))}" alt="">` : `<span class="spotify-artist-album-empty">♪</span>`}<b>${esc(album.name)}</b><small>${esc(album.releaseDate?.slice(0, 4) ?? "발매일 정보 없음")}${album.totalTracks ? ` · ${album.totalTracks}곡` : ""}</small></a>`).join("");
    return `<section class="artist-detail-page"><button class="text-button artist-page-back" data-artist-back>← 뒤로</button><header class="spotify-artist-header">${image}<div><span class="eyebrow">SPOTIFY 아티스트</span><h1>${esc(profile.name || artist)}</h1>${stats ? `<p>${esc(stats)}</p>` : ""}${profile.genres.length ? `<p class="spotify-artist-genres">${profile.genres.map(esc).join(" · ")}</p>` : ""}</div></header><section class="spotify-artist-releases"><div class="section-heading"><h2>앨범 및 싱글</h2><span>Spotify</span></div>${albumCards ? `<div class="spotify-artist-albums">${albumCards}</div>` : `<p class="queue-empty">표시할 발매 앨범이 없습니다.</p>`}</section></section>`;
  }

  function renderPage(): string {
    const page = options.page();
    const album = options.album();
    if (page === "artist") return renderArtist();
    if (page === "album" && album) return renderAlbum(album);
    if (page === "settings") return renderSettings();
    if (page === "library") return renderLibrary();
    return renderHome();
  }

  return { renderPage };
}
