import type { Track } from "../../types";
import type { TrackLyrics } from "../../services/lrclib";
import { esc } from "../../utils/format";
import { artistLinksMarkup } from "../library/trackPresentation";

interface LyricsRendererOptions {
  currentTrackId?: string;
  lyricsTrackId: string;
  lyrics: TrackLyrics | null;
  loading: boolean;
  error: boolean;
  wordMode: boolean;
}

interface NowPlayingRendererOptions {
  current: Track | null;
  playlistName: string;
  upcoming: Track[];
  favoriteIds: string[];
  lyricsEnabled: boolean;
  renderLyrics: () => string;
  artMarkup: (track: Track, size: "hero" | "mini") => string;
  artistLabel: (track: Pick<Track, "artist" | "source">) => string;
  icon: (name: string) => string;
}

export function renderLyricsCard(options: LyricsRendererOptions): string {
  const { currentTrackId, lyricsTrackId, lyrics, loading, error, wordMode } = options;
  const matched = lyricsTrackId === currentTrackId;
  const currentLyrics = matched ? lyrics : null;
  const showWordSync = Boolean(currentLyrics?.wordSynced && wordMode);
  const content = !matched || loading ? `<p class="lyrics-message">가사를 불러오는 중…</p>`
    : error ? `<p class="lyrics-message">가사를 불러오지 못했습니다.</p>`
      : !currentLyrics ? `<p class="lyrics-message">등록된 가사가 없습니다.</p>`
        : currentLyrics.lines.map((line, index) => currentLyrics.synced
          ? `<button type="button" class="lyrics-line synced" data-lyric-index="${index}" data-lyric-time="${line.time ?? 0}" aria-label="${esc(line.text)}로 이동">${showWordSync && line.words?.length ? line.words.map((word, wordIndex) => `<span class="lyric-word" data-word-index="${wordIndex}" data-word-time="${word.time}">${esc(word.text)}</span>`).join("") : esc(line.text)}</button>`
          : `<p class="lyrics-line">${esc(line.text)}</p>`).join("");
  const syncLabel = currentLyrics?.wordSynced ? `<button class="lyrics-mode-toggle" type="button" data-lyrics-mode aria-label="${wordMode ? "문장 싱크로" : "단어 싱크로"} 변경" title="단어/문장 싱크 전환">${wordMode ? "단어 싱크" : "문장 싱크"}</button>` : currentLyrics?.synced ? `<small>싱크</small>` : currentLyrics ? `<small>일반 가사</small>` : "";
  return `<section class="now-playing-lyrics"><div class="lyrics-heading"><strong>가사</strong>${matched ? syncLabel : ""}</div><div class="lyrics-scroll" data-lyrics-scroll>${content}</div></section>`;
}

export function renderNowPlayingPanel(options: NowPlayingRendererOptions): string {
  const { current, playlistName, upcoming, favoriteIds, lyricsEnabled, renderLyrics, artMarkup, artistLabel, icon } = options;
  // [오른쪽 사이드 패널] 현재 곡 상세, 크레딧, 다음 재생 항목, 앨범
  return `<aside class="now-playing-panel" aria-label="지금 재생 중"><div class="now-playing-panel-heading"><button class="now-playing-panel-toggle" data-now-playing-close title="패널 닫기" aria-label="지금 재생 패널 닫기">${icon("panel")}</button><strong>${esc(current ? playlistName : "지금 재생 중")}</strong><span class="now-playing-panel-menu" aria-hidden="true">•••</span><button class="now-playing-panel-expand" title="패널 닫기" aria-label="지금 재생 패널 닫기" data-now-playing-close>${icon("expand")}</button></div>${current ? `<button class="now-playing-large-art" data-now-playing-close title="앨범 보기" aria-label="현재 곡이 수록된 앨범 보기">${artMarkup(current, "hero")}</button><div class="now-playing-details"><div><h2 class="now-playing-title-link now-playing-panel-title-viewport" data-panel-marquee-title data-open-album role="link" tabindex="0" title="수록 앨범 보기"><span class="now-playing-panel-title-track">${esc(current.title)}</span></h2><p class="now-playing-artists" data-now-playing-artists><span class="now-playing-artists-track">${artistLinksMarkup(current)}</span></p></div>${current.spotifyUri ? `<button class="now-playing-share" data-panel-share title="Spotify 링크 복사" aria-label="Spotify 링크 복사">${icon("share")}</button>` : ""}<button class="like-button ${favoriteIds.includes(current.id) ? "liked" : ""}" data-like title="즐겨찾기" aria-label="즐겨찾기">${icon(favoriteIds.includes(current.id) ? "heart-filled" : "heart")}</button></div>${lyricsEnabled ? renderLyrics() : ""}<section class="now-playing-credits"><div class="now-playing-card-heading"><strong>크레딧</strong></div>${(current.artists?.length ? current.artists : [artistLabel(current)]).map((artist, index) => `<div class="now-playing-credit-row"><span><b><button class="now-playing-credit-artist" data-open-artist="${esc(artist)}" data-open-artist-id="${esc(current.artistIds?.[index] ?? "")}">${esc(artist)}</button></b><small>아티스트</small></span></div>`).join("")}</section>` : `<div class="now-playing-empty">재생 중인 곡이 없습니다.</div>`}<section class="now-playing-up-next"><div class="now-playing-card-heading"><strong>다음 재생 항목</strong><button data-panel-queue>재생목록 열기</button></div>${upcoming.length ? upcoming.map((track) => `<button class="now-playing-next-track" data-queue-item="${esc(track.id)}">${artMarkup(track, "mini")}<span><b class="now-playing-panel-title-viewport" data-panel-marquee-title><span class="now-playing-panel-title-track">${esc(track.title)}</span></b><small>${artistLinksMarkup(track)}</small></span></button>`).join("") : `<p>대기 중인 곡이 없습니다.</p>`}</section>${current ? `<section class="now-playing-album-info"><div class="now-playing-card-heading"><strong>수록 앨범</strong></div><button type="button" class="now-playing-album-card" data-open-album aria-label="${esc(current.album || current.title)} 앨범 페이지 열기">${artMarkup(current, "mini")}<span><b class="now-playing-panel-title-viewport" data-panel-marquee-title><span class="now-playing-panel-title-track">${esc(current.album?.trim() || "싱글")}</span></b><small>${esc(current.albumArtist || artistLabel(current))}</small></span><span class="now-playing-album-chevron" aria-hidden="true">›</span></button></section>` : ""}</aside>`;
}
