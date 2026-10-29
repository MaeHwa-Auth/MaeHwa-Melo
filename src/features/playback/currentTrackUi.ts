import type { PlaybackSnapshot, Track } from "../../types";
import { safeUrl } from "../../utils/format";
import { esc } from "../../utils/format";
import { artistLinksMarkup, nowMetaArtistMarkup } from "../library/trackPresentation";
import { markNowMetaArtists } from "../../ui/overflowTitles";

interface CurrentTrackUiOptions {
  app: HTMLElement;
  current: () => Track | null;
  snapshot: () => PlaybackSnapshot;
  favoriteIds: () => string[];
  lyricsEnabled: () => boolean;
  nowPlayingOpen: () => boolean;
  queuePanelOpen: () => boolean;
  setLyricsEntryPending: (pending: boolean) => void;
  artistLabel: (track: Pick<Track, "artist" | "source">) => string;
  artMarkup: (track: Track | null, size?: "hero" | "mini") => string;
  icon: (name: string) => string;
  replaceWithMarkup: (element: Element | null, markup: string) => void;
  refreshNowPlayingPanel: () => void;
  refreshQueuePanel: () => void;
  animateLyricsCardIn: (card: HTMLElement | null) => void;
  patchTrackRowPlaybackState: () => void;
  patchAlbumCardPlaybackState: () => void;
  patchProgress: () => void;
  refreshAmbientArtwork: (artwork?: string) => void;
  ensureLyricsLoaded: () => void;
}

export function createCurrentTrackUi(options: CurrentTrackUiOptions) {
  function patchCurrentTrackUi(): void {
    const current = options.current();
    const snapshot = options.snapshot();
    options.app.querySelector<HTMLElement>(".app-shell")?.classList.toggle("is-playing", snapshot.playing);
    const title = current?.title ?? "재생 중인 곡이 없습니다";
    const metadataRepairButton = options.app.querySelector<HTMLButtonElement>("[data-metadata-repair]");
    if (metadataRepairButton) {
      const available = current?.source === "local" && Boolean(current.localPath) && !current.localPath!.startsWith("blob:");
      metadataRepairButton.disabled = !available;
      if (available) metadataRepairButton.removeAttribute("title");
      else metadataRepairButton.title = "로컬 곡을 재생하면 보완할 수 있습니다";
    }
    const nowMeta = options.app.querySelector(".now-meta");
    if (nowMeta) nowMeta.innerHTML = `<strong ${current ? 'data-open-album role="link" tabindex="0" title="수록 앨범 보기"' : ""}>${esc(title)}</strong>${current ? nowMetaArtistMarkup(current) : "<span>라이브러리에서 곡을 선택하세요</span>"}`;
    markNowMetaArtists(options.app);
    options.replaceWithMarkup(options.app.querySelector(".now-playing .artwork"), options.artMarkup(current, "mini"));
    const lyricsToggle = options.app.querySelector<HTMLButtonElement>("[data-lyrics-toggle]");
    if (lyricsToggle) {
      lyricsToggle.disabled = !current;
      lyricsToggle.classList.toggle("active", options.lyricsEnabled());
      lyricsToggle.setAttribute("aria-pressed", String(options.lyricsEnabled()));
    }
    if (options.nowPlayingOpen()) {
      if (options.lyricsEnabled()) options.setLyricsEntryPending(true);
      if (options.queuePanelOpen()) options.refreshQueuePanel();
      else options.refreshNowPlayingPanel();
      if (options.lyricsEnabled()) options.animateLyricsCardIn(options.app.querySelector<HTMLElement>(".now-playing-lyrics"));
    }
    const likeButton = options.app.querySelector<HTMLButtonElement>(".now-playing [data-like]");
    if (likeButton) {
      const liked = Boolean(current && options.favoriteIds().includes(current.id));
      likeButton.classList.toggle("liked", liked);
      likeButton.innerHTML = options.icon(liked ? "heart-filled" : "heart");
      likeButton.disabled = !current;
    }
    const hero = options.app.querySelector<HTMLElement>(".hero-player");
    if (hero) {
      hero.classList.toggle("has-current-art", Boolean(current?.artwork));
      if (current?.artwork) hero.style.setProperty("--hero-image", `url('${safeUrl(current.artwork).replace(/'/g, "%27")}')`);
      else hero.style.removeProperty("--hero-image");
      const heroTitle = hero.querySelector<HTMLElement>("[data-hero-title]");
      const heroSubtitle = hero.querySelector<HTMLElement>("[data-hero-subtitle]");
      const heroSource = hero.querySelector<HTMLElement>("[data-hero-source]");
      if (heroTitle) heroTitle.textContent = current?.title ?? "재생할 곡을 선택하세요";
      if (heroSubtitle) heroSubtitle.innerHTML = current ? `${artistLinksMarkup(current)}${current.album ? ` · <span class="hero-album-link" data-open-album role="link" tabindex="0" title="수록 앨범 보기">${esc(current.album)}</span>` : ""}` : "내 라이브러리에서 음악을 고르거나 폴더를 추가하세요.";
      if (heroSource) heroSource.textContent = current ? current.source === "local" ? "로컬 음악" : "Spotify" : "지금 듣기";
      options.replaceWithMarkup(hero.querySelector(".artwork.hero"), options.artMarkup(current));
    }
    options.app.querySelectorAll<HTMLElement>("[data-track]").forEach((row) => {
      const selected = Boolean(current && row.dataset.track === current.id);
      row.classList.toggle("is-current", selected);
      const index = row.querySelector<HTMLElement>(".track-index");
      if (index) index.innerHTML = selected ? '<i class="equalizer"><b></b><b></b><b></b></i>' : row.dataset.rowNumber ?? "";
    });
    options.patchTrackRowPlaybackState();
    options.patchAlbumCardPlaybackState();
    const shell = options.app.querySelector<HTMLElement>(".app-shell");
    shell?.classList.toggle("playing-art", Boolean(current?.artwork));
    if (shell) {
      if (current?.artwork) shell.style.setProperty("--ambient", `url('${safeUrl(current.artwork).replace(/'/g, "%27")}')`);
      else shell.style.removeProperty("--ambient");
    }
    options.patchProgress();
    options.refreshAmbientArtwork(current?.artwork);
    options.ensureLyricsLoaded();
  }

  return { patchCurrentTrackUi };
}
