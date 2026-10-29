import type { SpotifyAlbumDetails } from "../../services/spotify";
import type { Track } from "../../types";
import { esc, formatTime, safeUrl } from "../../utils/format";
import { artistLinksMarkup } from "../library/trackPresentation";

export function renderPlaylistHeader(coverMarkup: string, eyebrow: string, title: string, metadata: string, description = ""): string {
  return `<div class="playlist-page-heading">${coverMarkup}<div class="playlist-page-copy"><span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(title)}</h1>${description ? `<p class="playlist-page-description">${esc(description)}</p>` : ""}<p class="playlist-page-meta">${metadata}</p></div></div>`;
}

export function renderEmpty(message: string, showFolderAction: boolean, heading: string, icon: (name: string) => string): string {
  return `<div class="empty-state"><span class="empty-orbit">${icon("music")}</span><h3>${esc(heading)}</h3><p>${esc(message)}</p>${showFolderAction ? `<button class="secondary-button" data-add-folder>${icon("plus")} 음악 폴더 선택</button>` : ""}</div>`;
}

export function renderHomePage(options: {
  recentTracks: Track[];
  current: Track | null;
  playing: boolean;
  artMarkup: (track: Track | null, size?: "hero" | "mini") => string;
  artistLabel: (track: Pick<Track, "artist" | "source"> | null | undefined) => string;
  icon: (name: string) => string;
  renderTrackTable: (tracks: Track[], compact: boolean) => string;
  renderEmpty: (message?: string, showFolderAction?: boolean, heading?: string) => string;
}): string {
  const { recentTracks, current, playing, artMarkup, artistLabel, icon, renderTrackTable, renderEmpty } = options;
  return `<section class="home-heading"><div><span class="eyebrow">MaeHwa Melo</span><h1>내 음악</h1></div><div class="home-import-actions"><button class="secondary-button" data-add-files>${icon("music")} 곡 파일 추가</button><button class="add-folder-button" data-add-folder>${icon("plus")} 폴더 추가</button></div></section>
    <section class="featured-section"><div class="hero-player ${current?.artwork ? "has-current-art" : ""}" ${current?.artwork ? `style="--hero-image:url('${esc(safeUrl(current.artwork)).replace(/'/g, "%27")}')"` : ""}>${artMarkup(current)}<div class="hero-info"><span class="eyebrow" data-hero-source>${current ? (current.source === "local" ? "로컬 음악" : "Spotify") : "지금 듣기"}</span><h2 data-hero-title>${esc(current?.title ?? "재생할 곡을 선택하세요")}</h2><p data-hero-subtitle>${current ? `${artistLinksMarkup(current)}${current.album ? ` · ${esc(current.album)}` : ""}` : "내 라이브러리에서 음악을 고르거나 폴더를 추가하세요."}</p><div class="hero-actions"><button class="primary-button" data-hero-play>${icon(playing ? "pause" : "play")} ${current && playing ? "일시정지" : "재생"}</button><button class="subtle-button" data-page="library">내 라이브러리 ${icon("chevron")}</button></div></div></div></section>
    <section class="library-preview"><div class="section-heading"><div><h2>최근 재생</h2></div><button class="text-button" data-page="library">모두 보기 ${icon("chevron")}</button></div>${recentTracks.length ? renderTrackTable(recentTracks, true) : renderEmpty("최근 재생한 곡이 여기에 표시됩니다.")}</section>`;
}

export function renderAlbumPage(options: {
  album: SpotifyAlbumDetails;
  currentSource?: Track["source"];
  query: string;
  view: "tracks" | "albums";
  sortTracks: (tracks: Track[], enabled: boolean) => Track[];
  renderPlaylistHeader: typeof renderPlaylistHeader;
  renderToolbar: (placeholder: string, inputId: string, showSort: boolean) => string;
  renderTrackTable: (tracks: Track[]) => string;
  renderAlbumGrid: (tracks: Track[]) => string;
  renderEmpty: (message: string, showFolderAction: boolean, heading: string) => string;
}): string {
  const { album, currentSource, query: rawQuery, view, sortTracks, renderPlaylistHeader, renderToolbar, renderTrackTable, renderAlbumGrid, renderEmpty } = options;
  const tracksInOrder = [...album.tracks].sort((a, b) => (a.discNumber ?? 1) - (b.discNumber ?? 1) || (a.trackNumber ?? 0) - (b.trackNumber ?? 0));
  const albumTrack: Track = { id: album.id, source: currentSource ?? "spotify", title: album.name, artist: album.artist, album: album.name, albumId: album.id, artwork: album.artwork };
  const totalSeconds = tracksInOrder.reduce((sum, track) => sum + (track.duration ?? 0), 0);
  const year = album.releaseDate?.slice(0, 4);
  const albumKind = tracksInOrder.length <= 3 ? "싱글" : "앨범";
  const coverLabel = `${album.name} 앨범 커버 크게 보기`;
  const coverMarkup = album.artwork ? `<img class="playlist-page-cover album-page-cover-enlarge" data-album-cover-enlarge role="button" tabindex="0" aria-label="${esc(coverLabel)}" src="${esc(safeUrl(album.artwork))}" alt="">` : `<div class="playlist-page-cover playlist-cover-placeholder album-page-cover-enlarge" data-album-cover-enlarge role="button" tabindex="0" aria-label="${esc(coverLabel)}"><span class="placeholder-mark">M</span></div>`;
  const albumArtists = artistLinksMarkup({ artist: album.artist || (albumTrack.source === "local" ? "알수없음" : "알 수 없는 아티스트"), artists: album.artists, artistIds: album.artistIds, source: albumTrack.source });
  const metadata = `${albumArtists}${year ? ` <span>·</span> ${year}` : ""} <span>·</span> ${tracksInOrder.length}곡 <span>·</span> 총 재생 시간 ${formatTime(totalSeconds)}`;
  const header = renderPlaylistHeader(coverMarkup, albumKind, album.name, metadata);
  const normalizedQuery = rawQuery.trim().toLocaleLowerCase();
  const filteredTracks = normalizedQuery ? tracksInOrder.filter((track) => `${track.title} ${track.artist} ${track.album}`.toLocaleLowerCase().includes(normalizedQuery)) : tracksInOrder;
  const items = sortTracks(filteredTracks, true);
  return `<section class="album-detail-page">${header}${renderToolbar("앨범 필터", "album-search", true)}${items.length ? view === "tracks" ? renderTrackTable(items) : renderAlbumGrid(items) : renderEmpty("이 앨범에서 일치하는 곡이 없습니다.", false, "곡이 없습니다")}</section>`;
}

export function renderSettingsPage(options: {
  spotifyReady: boolean;
  spotifyConnected: boolean;
  folders: string[];
  localTrackCount: number;
  icon: (name: string) => string;
}): string {
  const { spotifyReady, spotifyConnected, folders, localTrackCount, icon } = options;
  return `<div class="page-heading"><div><span class="eyebrow">MaeHwa Melo</span><h1>설정</h1><p>재생과 음악 폴더를 관리합니다.</p></div></div><section class="settings-section"><div class="settings-intro"><span class="settings-icon spotify-icon">${icon("spotify")}</span><div><h2>Spotify Premium</h2><p>Spotify 계정을 연결해 라이브러리를 가져옵니다.</p></div><span class="status-badge ${spotifyConnected ? "connected" : ""}">${spotifyConnected ? "연결됨" : "연결 안 됨"}</span></div><div class="spotify-setup"><p>${spotifyReady ? "Spotify 연결을 누르면 로그인과 접근 허용을 진행합니다." : "Spotify 연결은 앱 관리자가 준비 중입니다."}</p><div class="setup-actions"><button class="primary-button spotify-button" data-connect ${spotifyReady ? "" : "disabled"}>${spotifyConnected ? "다시 연결" : "Spotify 연결"}</button>${spotifyConnected ? `<button class="text-button disconnect-button" data-disconnect>연결 해제</button>` : ""}</div>${!spotifyReady ? `<div class="policy-note">Spotify 앱 설정이 완료되면 여기서 별도 ID 입력 없이 연결할 수 있습니다.</div>` : `<div class="policy-note">Spotify Premium과 Spotify 앱의 사용자 접근 허용이 필요합니다.</div>`}</div></section><section class="settings-section"><div class="settings-intro"><span class="settings-icon local-icon">${icon("music")}</span><div><h2>로컬 음악</h2><p>${folders.length}개 폴더 · ${localTrackCount}곡 등록됨</p></div></div><div class="folder-list">${folders.map((folder) => `<div class="folder-row"><span>${icon("folder")}</span><span>${esc(folder)}</span><button data-rescan="${esc(folder)}">${icon("refresh")} 갱신</button></div>`).join("")}</div><button class="secondary-button" data-add-folder>${icon("plus")} 음악 폴더 추가</button></section><section class="settings-section"><div class="settings-intro"><span class="settings-icon local-icon">↻</span><div><h2>앱 업데이트</h2><p>새 버전을 확인하고 MaeHwa Melo를 최신 상태로 유지합니다.</p></div></div><div class="spotify-setup"><button class="secondary-button" data-check-updates>업데이트 확인</button></div></section><section class="settings-section about-section"><span class="eyebrow">정보</span><p><b>MaeHwa Melo</b><span>Version 0.5.5 · Windows 10/11</span></p></section>`;
}
