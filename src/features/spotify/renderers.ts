import type { Track } from "../../types";
import { esc } from "../../utils/format";
import { artistLinksMarkup } from "../library/trackPresentation";

interface SpotifyPlaylistView {
  id: string;
  name: string;
}

interface SpotifySearchRendererOptions {
  query: string;
  connected: boolean;
  loading: boolean;
  tracks: Track[];
  targetTrackId: string | null;
  playlists: SpotifyPlaylistView[];
  selectedPlaylistId: string | null;
  artMarkup: (track: Track, size: "hero" | "mini") => string;
  icon: (name: string) => string;
}

interface PlaylistDialogRendererOptions {
  name: string;
  isPublic: boolean;
  visibilityOpen: boolean;
  busy: boolean;
  icon: (name: string) => string;
}

function renderPlaylistTargets(trackId: string, playlists: SpotifyPlaylistView[]): string {
  return `<div class="search-playlist-targets" data-target-track="${esc(trackId)}"><span>추가할 플레이리스트</span>${playlists.length ? playlists.map((playlist) => `<button data-add-target="${esc(playlist.id)}">${esc(playlist.name)}</button>`).join("") : `<small>플레이리스트가 없습니다.</small>`}<button class="create-target-playlist" data-create-playlist>새 플레이리스트 만들기</button></div>`;
}

export function renderTopSearchResults(options: SpotifySearchRendererOptions): string {
  const { query: rawQuery, connected, loading, tracks, targetTrackId, playlists, selectedPlaylistId, artMarkup, icon } = options;
  const query = rawQuery.trim();
  let body = "";
  if (!query) body = `<div class="top-search-message">Spotify에서 곡, 아티스트를 검색하세요.</div>`;
  else if (!connected) body = `<div class="top-search-message">검색하려면 Spotify 계정을 연결하세요.<button class="top-search-connect" data-connect>Spotify 연결</button></div>`;
  else if (loading) body = `<div class="top-search-message">검색 중…</div>`;
  else if (!tracks.length) body = `<div class="top-search-message">검색 결과가 없습니다.</div>`;
  else body = tracks.map((track, index) => `<div class="top-search-result-row"><button class="top-search-result" data-search-track="${esc(track.id)}" data-search-index="${index}">${artMarkup(track, "mini")}<span class="top-search-track-meta"><strong>${esc(track.title)}</strong><small>${artistLinksMarkup(track)}${track.album ? ` · ${esc(track.album)}` : ""}</small></span><span class="top-search-play">${icon("play")}</span></button><button class="top-search-add" data-search-add="${esc(track.id)}" title="${selectedPlaylistId ? "현재 플레이리스트에 추가" : "플레이리스트에 추가"}" aria-label="${esc(track.title)} 플레이리스트에 추가">${icon("plus")}</button></div>${targetTrackId === track.id ? renderPlaylistTargets(track.id, playlists) : ""}`).join("");
  return `<div class="top-search-dropdown"><div class="top-search-heading">${query ? "Spotify 검색 결과" : "검색"}</div>${body}</div>`;
}

export function renderPlaylistDialog(options: PlaylistDialogRendererOptions): string {
  const { name, isPublic, visibilityOpen, busy, icon } = options;
  const visibilityLabel = isPublic ? "공개 · Spotify 프로필에 표시" : "비공개 · 나만 볼 수 있음";
  return `<div class="playlist-modal-backdrop" data-playlist-backdrop><form class="playlist-modal" data-playlist-form><div class="playlist-modal-heading"><div><span class="eyebrow">SPOTIFY PLAYLIST</span><h2>새 플레이리스트</h2></div><button type="button" class="playlist-modal-close" data-playlist-cancel aria-label="닫기">×</button></div><label for="playlist-name">이름</label><input id="playlist-name" name="name" value="${esc(name)}" maxlength="100" placeholder="플레이리스트 이름" autocomplete="off" required ${busy ? "disabled" : ""}><label id="playlist-visibility-label">공개 범위</label><div class="visibility-select"><button type="button" class="visibility-trigger" data-visibility-toggle aria-haspopup="listbox" aria-labelledby="playlist-visibility-label" aria-expanded="${visibilityOpen}" ${busy ? "disabled" : ""}><span>${visibilityLabel}</span>${icon("chevron")}</button>${visibilityOpen ? `<div class="visibility-options" role="listbox" aria-label="공개 범위"><button type="button" role="option" aria-selected="${!isPublic}" data-visibility-option="private"><span>비공개 · 나만 볼 수 있음</span>${!isPublic ? icon("check") : ""}</button><button type="button" role="option" aria-selected="${isPublic}" data-visibility-option="public"><span>공개 · Spotify 프로필에 표시</span>${isPublic ? icon("check") : ""}</button></div>` : ""}</div><p>공개 설정은 Spotify에서도 변경할 수 있습니다.</p><div class="playlist-modal-actions"><button type="button" class="secondary-button" data-playlist-cancel ${busy ? "disabled" : ""}>취소</button><button type="submit" class="primary-button" ${busy ? "disabled" : ""}>${busy ? "만드는 중…" : "만들기"}</button></div></form></div>`;
}
