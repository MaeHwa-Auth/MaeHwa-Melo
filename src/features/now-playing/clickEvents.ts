import type { Track } from "../../types";

type Page = import("../../types").AppPage;

interface NowPlayingClickOptions {
  app: HTMLElement;
  lyricsWordSynced: () => boolean;
  toggleLyricsWordMode: () => void;
  updateLyricsMode: () => void;
  lyricsSynced: () => boolean;
  seekLyrics: (time: number) => void;
  lyricsEnabled: () => boolean;
  setLyricsEnabled: (enabled: boolean) => void;
  setLyricsEntryPending: (pending: boolean) => void;
  nowPlayingPanelExists: () => boolean;
  openNowPlaying: () => void;
  compactSidebar: () => void;
  updateLyricsCard: () => void;
  abortLyricsLoad: () => void;
  ensureLyricsLoaded: () => void;
  page: () => Page;
  setPage: (page: Page) => void;
  albumReturnPage: () => Page;
  renderMainPage: () => string;
  setLastRenderedPage: (page: Page) => void;
  bindEvents: () => void;
  openCurrentAlbum: () => void;
  closeNowPlaying: () => void;
  nowPlayingOpen: () => boolean;
  setNowPlayingOpen: (open: boolean) => void;
  setQueueTab: (tab: "queue" | "recent") => void;
  showQueuePanel: (show: boolean) => void;
  render: () => void;
  current: () => Track | null;
  showNotice: (message: string) => void;
  queue: () => Track[];
  playTrack: (track: Track, queue: Track[]) => void;
}

export function handleNowPlayingClick(target: HTMLElement, options: NowPlayingClickOptions): boolean {
  if (target.closest("[data-lyrics-mode]") && options.lyricsWordSynced()) {
    options.toggleLyricsWordMode();
    options.updateLyricsMode();
    return true;
  }
  const lyricWord = target.closest<HTMLElement>("[data-word-time]");
  const lyricLine = target.closest<HTMLElement>("[data-lyric-time]");
  if (lyricLine && options.lyricsSynced()) {
    const time = Number(lyricWord?.dataset.wordTime ?? lyricLine.dataset.lyricTime);
    if (Number.isFinite(time)) options.seekLyrics(time);
    return true;
  }
  if (target.closest("[data-lyrics-toggle]")) {
    const button = options.app.querySelector<HTMLButtonElement>("[data-lyrics-toggle]");
    if (!options.nowPlayingPanelExists()) {
      options.setLyricsEnabled(true);
      options.setLyricsEntryPending(true);
      button?.classList.add("active");
      button?.setAttribute("aria-pressed", "true");
      options.openNowPlaying();
      return true;
    }
    const enabled = !options.lyricsEnabled();
    options.setLyricsEnabled(enabled);
    button?.classList.toggle("active", enabled);
    button?.setAttribute("aria-pressed", String(enabled));
    if (enabled) {
      options.setLyricsEntryPending(true);
      if (window.innerWidth <= 1000) options.compactSidebar();
      options.updateLyricsCard();
      options.ensureLyricsLoaded();
    } else {
      options.abortLyricsLoad();
      options.updateLyricsCard();
    }
    return true;
  }
  if (target.closest(".now-playing-large-art")) {
    if (options.page() === "album") {
      const page = options.albumReturnPage();
      options.setPage(page);
      const mainContent = options.app.querySelector<HTMLElement>(".main-content");
      if (mainContent) { mainContent.innerHTML = options.renderMainPage(); options.setLastRenderedPage(page); options.bindEvents(); }
    } else options.openCurrentAlbum();
    return true;
  }
  if (target.closest("[data-now-playing-close]")) { options.closeNowPlaying(); return true; }
  if (target.closest("[data-now-playing]")) {
    if (options.nowPlayingOpen()) options.closeNowPlaying(); else options.openNowPlaying();
    return true;
  }
  if (target.closest("[data-panel-queue]")) { options.setQueueTab("queue"); options.showQueuePanel(true); return true; }
  const current = options.current();
  if (target.closest("[data-panel-share]") && current?.spotifyUri) {
    const id = current.spotifyUri.split(":").at(-1);
    if (id) void navigator.clipboard.writeText(`https://open.spotify.com/track/${id}`).then(() => options.showNotice("Spotify 링크를 복사했습니다.")).catch(() => options.showNotice("Spotify 링크를 복사하지 못했습니다."));
    return true;
  }
  const upcomingTarget = target.closest<HTMLElement>("[data-queue-item]");
  if (upcomingTarget) {
    const queue = options.queue();
    const track = queue.find((item) => item.id === upcomingTarget.dataset.queueItem);
    if (track) options.playTrack(track, queue);
    return true;
  }
  return false;
}
