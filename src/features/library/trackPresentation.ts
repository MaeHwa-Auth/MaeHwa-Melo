import type { Track } from "../../types";
import { esc, safeUrl } from "../../utils/format";

document.addEventListener("error", (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.classList.contains("artwork-image")) return;
  image.remove();
  const artwork = image.closest(".artwork");
  artwork?.classList.remove("has-image");
  artwork?.classList.add("no-image");
}, true);

export function artistLabel(track: Pick<Track, "artist" | "source"> | null | undefined): string {
  const artist = track?.artist?.trim();
  if (artist) return artist;
  return track?.source === "local" ? "알수없음" : "알 수 없는 아티스트";
}

export function artistLinksMarkup(track: Pick<Track, "artist" | "artists" | "artistIds" | "source">, className = ""): string {
  const artists = track.artists?.length ? track.artists : [artistLabel(track)];
  return artists.map((name, index) => `<span class="artist-link ${className}" data-open-artist="${esc(name)}" data-open-artist-id="${esc(track.artistIds?.[index] ?? "")}" role="link" tabindex="0">${esc(name)}</span>`).join(`<span class="artist-link-separator">, </span>`);
}

export function nowMetaArtistMarkup(track: Track): string {
  return `<span class="now-meta-subtitle"><span class="now-meta-artist-viewport" data-now-meta-artists><span class="now-meta-artist-track">${artistLinksMarkup(track)}</span></span>${track.album ? `<span class="now-meta-album" data-open-album role="link" tabindex="0"> · ${esc(track.album)}</span>` : ""}</span>`;
}

export function artMarkup(track: Track | null, size: "hero" | "mini" = "hero"): string {
  const title = track?.title ?? "MaeHwa Melo";
  const artist = track ? artistLabel(track) : "앨범 아트";
  const artwork = track?.artwork ? `<img class="artwork-image" src="${esc(safeUrl(track.artwork))}" alt="" draggable="false">` : "";
  return `<div class="artwork ${size} ${track?.artwork ? "has-image" : "no-image"}">${artwork}<div class="art-placeholder"><span class="placeholder-mark">M</span><span class="placeholder-title">${esc(title.slice(0, 24))}</span><span class="placeholder-artist">${esc(artist.slice(0, 28))}</span></div></div>`;
}
