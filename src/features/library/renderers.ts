import type { Track } from "../../types";
import { esc, formatTime } from "../../utils/format";
import { artistLinksMarkup } from "./trackPresentation";

interface TrackTableOptions {
  compact?: boolean;
  currentTrackId?: string;
  playing: boolean;
  favoriteIds: string[];
  artMarkup: (track: Track, size: "hero" | "mini") => string;
  artistLabel: (track: Pick<Track, "artist" | "source">) => string;
  icon: (name: string) => string;
}

interface AlbumGridOptions {
  current: Track | null;
  playing: boolean;
  albumGroupingKey: (track: Track) => string;
  albumPlaybackStatus: (playing: boolean) => string;
  artMarkup: (track: Track, size: "hero" | "mini") => string;
  artistLabel: (track: Pick<Track, "artist" | "source">) => string;
  icon: (name: string) => string;
}

export function renderTrackTable(items: Track[], options: TrackTableOptions): string {
  const { compact = false, currentTrackId, playing, favoriteIds, artMarkup, artistLabel, icon } = options;
  return `<div class="track-table ${compact ? "compact" : ""}"><div class="track-head"><span class="track-index">#</span><span>곡</span><span>앨범</span><span>소스</span><span>재생 시간</span><span></span></div>${items.map((track, index) => `<button class="track-row ${currentTrackId === track.id ? "is-current" : ""} ${track.available === false ? "unavailable" : ""}" data-track="${esc(track.id)}" data-row-number="${String(index + 1).padStart(2, "0")}"><span class="track-index">${currentTrackId === track.id ? '<i class="equalizer"><b></b><b></b><b></b></i>' : String(index + 1).padStart(2, "0")}</span><span class="track-identity">${artMarkup(track, "mini")}<span><strong><span class="track-title-marquee" data-marquee-title>${esc(track.title)}</span></strong><small>${track.available === false ? "파일을 찾을 수 없음 · 폴더를 갱신하세요" : artistLinksMarkup(track)}</small></span><span class="row-play" data-row-play title="${currentTrackId === track.id && playing ? "일시정지" : "재생"}" aria-label="${esc(track.title)} ${currentTrackId === track.id && playing ? "일시정지" : "재생"}">${icon(currentTrackId === track.id && playing ? "pause" : "play")}</span></span><span class="track-album"><span class="track-album-marquee" data-album-marquee>${esc(track.album || "싱글")}</span></span><span class="track-source ${track.source}">${track.source === "local" ? "로컬" : "Spotify"}</span><span class="track-duration">${formatTime(track.duration ?? 0)}</span><span class="track-like ${favoriteIds.includes(track.id) ? "liked" : ""}" data-like-id="${esc(track.id)}">${icon(favoriteIds.includes(track.id) ? "heart-filled" : "heart")}</span></button>`).join("")}</div>`;
}

export function albumPlaybackStatus(isPlaying: boolean, icon: (name: string) => string): string {
  return isPlaying
    ? `<i class="equalizer album-playing-equalizer"><b></b><b></b><b></b></i><span class="album-hover-pause">${icon("pause")}</span>`
    : icon("play");
}

export function renderAlbumGrid(items: Track[], options: AlbumGridOptions): string {
  const { current, playing, albumGroupingKey, artMarkup, artistLabel, icon } = options;
  const albums = new Map<string, Track[]>();
  for (const track of items) { const key = albumGroupingKey(track); albums.set(key, [...(albums.get(key) ?? []), track]); }
  return `<div class="album-grid">${[...albums.entries()].map(([key, albumTracks]) => {
    const first = albumTracks[0];
    const ordered = [...albumTracks].sort((a, b) => (a.discNumber ?? 1) - (b.discNumber ?? 1) || (a.trackNumber ?? 0) - (b.trackNumber ?? 0));
    const isCurrentAlbum = Boolean(current && albumGroupingKey(current) === key);
    const isPlayingAlbum = isCurrentAlbum && playing;
    const albumLabel = first.album.trim() || first.title;
    return `<button class="album-card ${isCurrentAlbum ? "is-current" : ""} ${isPlayingAlbum ? "is-playing" : ""}" data-album="${encodeURIComponent(key)}" data-album-track-ids="${encodeURIComponent(JSON.stringify(ordered.map((track) => track.id)))}"><div class="album-art">${artMarkup(first, "hero")}<span class="album-play" data-album-play data-playing="${isPlayingAlbum}" title="${isPlayingAlbum ? "일시정지" : "재생"}" aria-label="${esc(albumLabel)} ${isPlayingAlbum ? "일시정지" : "재생"}">${albumPlaybackStatus(isPlayingAlbum, icon)}</span></div><strong><span class="album-title-marquee" data-marquee-title>${esc(albumLabel)}</span></strong><small>${artistLinksMarkup({ artist: first.albumArtist || artistLabel(first), source: first.source })}</small><span class="album-count">${ordered.length}곡${first.year ? ` · ${first.year}` : ""}</span></button>`;
  }).join("")}</div>`;
}
