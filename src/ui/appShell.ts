import type { Track, PlaybackSnapshot } from "../types";
import { esc, formatTime, safeUrl } from "../utils/format";
import { nowMetaArtistMarkup } from "../features/library/trackPresentation";

type Page = import("../types").AppPage;
type Filter = "all" | "local" | "spotify";

interface AppShellOptions {
  current: Track | null;
  page: Page;
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  filter: Filter;
  favoritesOnly: boolean;
  favoriteCount: number;
  topSearchOpen: boolean;
  topSearchQuery: string;
  nowPlayingOpen: boolean;
  nowPlayingOpening: boolean;
  nowPlayingWidth: number;
  sidebarCompact: boolean;
  sidebarAutoCollapsing: boolean;
  expandedSidebarWidth: number;
  maxNowPlayingWidth: number;
  snapshot: PlaybackSnapshot;
  lyricsEnabled: boolean;
  favoriteIds: string[];
  sidebarPlaylists: string;
  mainPage: string;
  searchResults: string;
  metadataDialog: string;
  playlistDialog: string;
  brandLogo: string;
  spotifyIconAsset: string;
  spotifyConnected: boolean;
  spotifyReady: boolean;
  icon: (name: string) => string;
  artMarkup: (track: Track | null, size?: "hero" | "mini") => string;
  artistLabel: (track: Pick<Track, "artist" | "source"> | null | undefined) => string;
}

export function renderAppShell(options: AppShellOptions): string {
  const { current, page, canNavigateBack, canNavigateForward, filter, favoritesOnly, favoriteCount, topSearchOpen, topSearchQuery, nowPlayingOpen, nowPlayingOpening, nowPlayingWidth, sidebarCompact, sidebarAutoCollapsing, expandedSidebarWidth, maxNowPlayingWidth, snapshot, lyricsEnabled, favoriteIds, sidebarPlaylists, mainPage, searchResults, metadataDialog, playlistDialog, brandLogo, spotifyIconAsset, spotifyConnected, spotifyReady, icon, artMarkup, artistLabel } = options;
  const artworkStyle = current?.artwork ? `style="--ambient:url('${esc(safeUrl(current.artwork)).replace(/'/g, "%27")}')"` : "";
  const sidebarWidth = sidebarCompact ? 92 : expandedSidebarWidth;

  // [상단 영역] 앱 헤더, 검색창, 창 제어 버튼
  const topbar = `<header class="topbar"><div class="brand"><img class="brand-logo" src="${brandLogo}" alt=""><span>MaeHwa <span class="brand-light">Melo</span></span></div><div class="navigation-history" aria-label="페이지 이동"><button class="history-button" data-history-back title="뒤로 이동" aria-label="뒤로 이동" ${canNavigateBack ? "" : "disabled"}>${icon("history-back")}</button><button class="history-button" data-history-forward title="앞으로 이동" aria-label="앞으로 이동" ${canNavigateForward ? "" : "disabled"}>${icon("history-forward")}</button></div><div class="top-search-wrap ${topSearchOpen ? "open" : ""}"><label class="top-search">${icon("search")}<input id="top-search-input" value="${esc(topSearchQuery)}" placeholder="Spotify 곡 검색" autocomplete="off" aria-label="Spotify 곡 검색"><button class="top-search-clear" data-search-clear aria-label="검색어 지우기" title="검색어 지우기" ${topSearchQuery ? "" : "hidden"}>×</button></label>${topSearchOpen ? searchResults : ""}</div><div class="top-actions"><button class="icon-button" data-page="settings" title="설정" aria-label="설정">${icon("settings")}</button><div class="window-controls"><button class="window-control" data-window-minimize title="최소화" aria-label="최소화">${icon("minimize")}</button><button class="window-control" data-window-maximize title="최대화" aria-label="최대화">${icon("maximize")}</button><button class="window-control close" data-window-close title="닫기" aria-label="닫기">${icon("close")}</button></div></div></header>`;

  // [왼쪽 사이드 패널] 탐색 메뉴, 플레이리스트 목록, Spotify 연결
  const sidebar = `<aside class="sidebar ${sidebarCompact ? "is-compact" : ""} ${sidebarAutoCollapsing ? "is-auto-collapsing" : ""}" style="--sidebar-width:${sidebarWidth}px;width:${sidebarWidth}px;flex:0 0 ${sidebarWidth}px"><div class="side-group"><button class="nav-link ${page === "home" ? "selected" : ""}" data-page="home" title="홈">${icon("home")} 홈</button></div><div class="side-rule home-side-rule"></div><div class="side-group"><button class="nav-link ${page === "library" && filter === "all" && !favoritesOnly ? "selected" : ""}" data-page="library" title="전체">${icon("library")} 전체</button><button class="nav-link ${page === "library" && filter === "spotify" && !favoritesOnly ? "selected" : ""}" data-page="library" data-filter="spotify" title="Spotify"><span class="spotify-glyph">${icon("spotify")}</span> Spotify</button><button class="nav-link ${page === "library" && filter === "local" && !favoritesOnly ? "selected" : ""}" data-page="library" data-filter="local" title="로컬 음악">${icon("music")} 로컬 음악</button><button class="nav-link ${page === "library" && favoritesOnly ? "selected" : ""}" data-favorites title="즐겨찾기">${icon("heart")} 즐겨찾기 <span class="nav-count">${favoriteCount || ""}</span></button></div>${sidebarPlaylists}<div class="side-rule"></div><button class="connect-card" data-connect><span class="connect-icon"><img class="spotify-mark" src="${spotifyIconAsset}" alt=""></span><span><b>${spotifyConnected ? "Spotify 연결됨" : spotifyReady ? "Spotify 연결" : "Spotify 연결 준비 중"}</b><small>${spotifyConnected ? "Premium 플레이어 준비" : spotifyReady ? "계정 로그인 후 허용" : "앱 설정 준비 중"}</small></span>${icon("chevron")}</button></aside>`;

  // [중앙 영역] 현재 탭에서 렌더링한 홈·라이브러리·앨범·설정 화면
  const centerContent = `<main class="main-content">${mainPage}</main>`;

  // [왼쪽 사이드 패널] 너비 전환 핸들
  const sidebarResizer = `<div class="sidebar-resizer" data-sidebar-resizer role="separator" aria-label="사이드바 너비 전환" aria-orientation="vertical" aria-valuemin="92" aria-valuemax="${expandedSidebarWidth}" aria-valuenow="${sidebarWidth}" aria-valuetext="${sidebarCompact ? "축소" : "전체"}" tabindex="0" title="드래그해 사이드바를 축소하거나 확장"></div>`;

  // [오른쪽 사이드 패널] 지금 재생 중 패널의 너비 조절과 배치 슬롯
  const panelResizer = nowPlayingOpen ? `<div class="now-playing-resizer" data-now-playing-resizer role="separator" aria-label="재생 패널 너비 조절" aria-orientation="vertical" aria-valuemin="280" aria-valuemax="${maxNowPlayingWidth}" aria-valuenow="${Math.min(nowPlayingWidth, maxNowPlayingWidth)}" tabindex="0" title="드래그하거나 방향키로 패널 크기 조절"></div>` : "";
  const nowPlayingPlaceholder = nowPlayingOpen ? `<div id="now-playing-slot-placeholder"></div>` : "";

  // [하단 영역] 곡 정보, 재생 컨트롤, 진행 바, 음량·대기열
  const footer = `<footer class="player-bar"><div class="now-playing"><button class="now-playing-cover" data-now-playing title="지금 재생 중인 곡 보기" aria-label="지금 재생 중인 곡 정보 열기">${artMarkup(current, "mini")}</button><div class="now-meta"><strong ${current ? 'data-open-album role="link" tabindex="0" title="수록 앨범 보기"' : ""}>${esc(current?.title ?? "재생 중인 곡이 없습니다")}</strong>${current ? nowMetaArtistMarkup(current) : "<span>라이브러리에서 곡을 선택하세요</span>"}</div><button class="like-button ${current && favoriteIds.includes(current.id) ? "liked" : ""}" data-like title="즐겨찾기" aria-label="즐겨찾기">${icon(favoriteIds.includes(current?.id ?? "") ? "heart-filled" : "heart")}</button></div><div class="player-center"><div class="controls"><button class="control-button minor ${snapshot.shuffle ? "active" : ""}" data-shuffle title="셔플">${icon("shuffle")}</button><button class="control-button" data-previous title="이전 곡">${icon("previous")}</button><button class="play-button" data-play title="재생/일시정지">${icon(snapshot.playing ? "pause" : "play")}</button><button class="control-button" data-next title="다음 곡">${icon("next")}</button><button class="control-button minor ${snapshot.repeat !== "off" ? "active" : ""}" data-repeat aria-pressed="${snapshot.repeat !== "off"}" title="반복: ${snapshot.repeat === "one" ? "한 곡" : snapshot.repeat === "all" ? "전체" : "끔"}">${icon(snapshot.repeat === "one" ? "repeat-one" : "repeat")}</button></div><div class="timeline"><span>${formatTime(snapshot.position)}</span><input type="range" data-seek min="0" max="${Math.max(snapshot.duration, 1)}" value="${Math.min(snapshot.position, snapshot.duration || 1)}" aria-label="재생 위치"><span>${formatTime(snapshot.duration)}</span></div></div><div class="player-right"><button class="control-button lyrics-toggle ${lyricsEnabled ? "active" : ""}" data-lyrics-toggle aria-pressed="${lyricsEnabled}" title="가사" aria-label="가사" ${current ? "" : "disabled"}>${icon("lyrics")}</button><button class="volume-icon" data-mute title="${snapshot.volume === 0 ? "음소거 해제" : "음소거"}" aria-label="${snapshot.volume === 0 ? "음소거 해제" : "음소거"}">${icon(snapshot.volume === 0 ? "muted" : "volume")}</button><input type="range" class="volume-slider" data-volume min="0" max="1" step="0.01" value="${snapshot.volume}" aria-label="음량"><button class="queue-toggle" data-queue title="재생 대기열" aria-label="재생 대기열">${icon("queue")}</button></div></footer>`;
  return `<div class="app-shell ${current?.artwork ? "playing-art" : ""}" ${artworkStyle}>${topbar}<div class="workspace ${nowPlayingOpen ? `has-now-playing${nowPlayingOpening ? " is-opening" : ""}` : ""}" style="--now-playing-width:${nowPlayingWidth}px">${sidebar}${sidebarResizer}${centerContent}${panelResizer}${nowPlayingPlaceholder}</div>${metadataDialog}${playlistDialog}${footer}<div class="notice" id="notice"></div></div>`;
}
