import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { LocalPlayer } from "./player/LocalPlayer";
import { favorites, isTauriRuntime, persistLibrary, savedFavoriteTracks, savedFolders, savedTracks, saveFavoriteTracks, saveFavorites } from "./services/library";
import { disconnectSpotify, hasSpotifyClientId, loginSpotify, spotifyAlbumTracks, spotifyArtistProfile, spotifyConnected, spotifyHasPlaylistWriteScope, spotifyPlaylistTracks, SpotifyPlayer } from "./services/spotify";
import type { SpotifyAlbumDetails, SpotifyArtistProfile, SpotifySavedAlbum, SpotifyTopArtist } from "./services/spotify";
import type { AppPage } from "./types";
import { findLyrics } from "./services/lrclib";
import type { TrackLyrics } from "./services/lrclib";
import { initCustomScrollbars, refreshCustomScrollbars } from "./ui/customScrollbars";
import { icon } from "./ui/icons";
import { esc, safeUrl } from "./utils/format";
import { captureNativeTooltips, clearTooltipSuppression, hideCustomTooltip, initCustomTooltips } from "./ui/tooltips";
import { expandedSidebarWidth, maxNowPlayingWidth, observeResponsiveLayout } from "./ui/panelLayout";
import { createWindowAndPanelControls } from "./ui/windowAndPanelControls";
import { createRenderLifecycle } from "./ui/renderLifecycle";
import { renderAppShell } from "./ui/appShell";
import { createNowPlayingPanel } from "./ui/nowPlayingPanel";
import { createPanelSizing } from "./ui/panelSizing";
import { startAppLifecycle } from "./ui/appLifecycle";
import { bindGlobalClickDispatcher } from "./ui/globalClickDispatcher";
import { replaceWithMarkup } from "./ui/dom";
import { createIntroController } from "./ui/intro";
import { createNoticeController } from "./ui/notices";
import { albumPlaybackStatus, renderAlbumGrid, renderTrackTable } from "./features/library/renderers";
import { createMetadataRepair } from "./features/metadata/MetadataRepair";
import { createNowPlayingContent } from "./features/now-playing/content";
import { currentQueueIndex, nextQueueIndex, normalizeTrackKey, safeQueueForTrack, sameTrackId } from "./features/playback/queue";
import { createPlaybackControls, resolvePlaybackIntent as resolvePlaybackIntentState } from "./features/playback/controls";
import { bindPlaybackEvents } from "./features/playback/events";
import { renderQueueDrawer } from "./features/playback/queueDrawer";
import type { QueueDrawerTab } from "./features/playback/queueDrawer";
import { createCurrentTrackUi } from "./features/playback/currentTrackUi";
import { createSpotifyViewerSync } from "./features/playback/spotifyViewerSync";
import { createPlaylistLoader } from "./features/spotify/playlistLoader";
import { createSpotifyLibraryRefresh } from "./features/spotify/libraryRefresh";
import { createSpotifySearch } from "./features/spotify/search";
import { createPlaySearchResult } from "./features/spotify/playSearchResult";
import { createSpotifyDisconnect } from "./features/spotify/disconnect";
import { bindSpotifySearchEvents } from "./features/spotify/searchEvents";
import { handleSpotifyActionClick } from "./features/spotify/actionClickEvents";
import { createSpotifySearchDropdown } from "./features/spotify/searchDropdown";
import { createPlaylistPermissionCheck } from "./features/spotify/playlistPermissions";
import { createAddSearchTrack } from "./features/spotify/addSearchTrack";
import { createSpotifyPlaylistCreator } from "./features/spotify/createPlaylist";
import { createLibrarySearch } from "./features/library/search";
import { bindLibrarySearchEvents } from "./features/library/searchEvents";
import { bindLibrarySourceEvents } from "./features/library/sourceEvents";
import { createPageRenderer } from "./features/pages/page";
import { bindLibraryPageEvents } from "./features/library/pageEvents";
import { createLocalImport } from "./features/library/localImport";
import { createLibraryBoot } from "./features/library/boot";
import { createLibraryTrackSelectors } from "./features/library/selectors";
import { patchAlbumCardPlaybackState as patchAlbumCards, patchTrackRowPlaybackState as patchTrackRows } from "./features/library/playbackUi";
import { createProgressController } from "./features/playback/progressController";
import { albumGroupingKey } from "./features/library/albumGrouping";
import { markOverflowingAlbumTitles as markOverflowingTitlesInRoot } from "./ui/overflowTitles";
import { refreshAmbientArtwork } from "./ui/ambientArtwork";
import { createSyncedLyricsUpdater } from "./features/now-playing/syncLyrics";
import { bindLyricsScrollIntent, createLyricsUi } from "./features/now-playing/lyricsUi";
import { createLyricsLoader } from "./features/now-playing/lyricsLoader";
import { handleNowPlayingClick } from "./features/now-playing/clickEvents";
import { createCurrentAlbumResolver } from "./features/library/albumResolver";
import { createOpenAlbumPage } from "./features/library/openAlbumPage";
import { scrollToTrack } from "./features/library/scrollToTrack";
import { autoConnectSpotifyOnBoot as autoConnectSpotify, createSpotifyConnection } from "./features/spotify/connection";
import { mergeTracks } from "./features/library/mergeTracks";
import { readRecentTrackIds, recordRecentTrack, resolveRecentTracks } from "./features/library/recentTracks";
import { artistLabel, artMarkup } from "./features/library/trackPresentation";
import { persistPlaybackState, readRestoreState } from "./features/playback/persistence";
import { initAppUpdater } from "./services/appUpdater";
import { applyPersonalizationPreferences, updatePersonalizationPreference } from "./services/personalization";
import type { RestoreState } from "./features/playback/persistence";
import { createPlaybackRestore } from "./features/playback/restore";
import { createSpotifyAutoAdvance } from "./features/playback/spotifyAutoAdvance";
import { bindLocalPlayerEvents } from "./features/playback/localPlayerEvents";
import { createTrackPlayback } from "./features/playback/playTrack";
import { createTogglePlay } from "./features/playback/togglePlay";
import { toggleFavorite as toggleFavoriteInFeature } from "./features/playback/favorites";
import { renderSpotifySidebarPlaylists as renderSpotifySidebarPlaylistsMarkup, sortLibraryTracks as sortLibraryTracksByMode } from "./features/library/controls";
import type { LibrarySortMode } from "./features/library/controls";
import { renderPlaylistDialog as renderPlaylistDialogMarkup } from "./features/spotify/renderers";
import type { PlaybackSnapshot, Track } from "./types";
import "./styles.css";
import "./album.css";
import "./redesign.css";
import "./app-updates.css";

applyPersonalizationPreferences();

type Page = AppPage;
type SourceFilter = "all" | "local" | "spotify";
interface NavigationEntry {
  page: Page;
  filter: SourceFilter;
  favoritesOnly: boolean;
  selectedPlaylistId: string | null;
  selectedPlaylistTracks: Track[];
  albumView: SpotifyAlbumDetails | null;
  albumReturnPage: Page;
  activeArtist: string;
  activeArtistId: string;
  activeArtistProfile: SpotifyArtistProfile | null;
  artistProfileError: string;
  artistReturnPage: Page;
}
const localPlayer = new LocalPlayer();
const spotifyPlayer = new SpotifyPlayer();
let restoreState = readRestoreState();
let playbackPlaylistId: string | null = restoreState.playlistId ?? null;
let tracks: Track[] = savedTracks();
let folders = savedFolders();
let favoriteIds = favorites();
let favoriteTracks = savedFavoriteTracks();
let page: Page = "home";
let activeArtist = "";
let activeArtistId = "";
let activeArtistProfile: SpotifyArtistProfile | null = null;
let savedAlbumRequest = 0;
let artistProfileLoading = false;
let artistProfileError = "";
let artistProfileRequest = 0;
let artistNavigationBound = false;
let albumCoverFocusTarget: HTMLElement | null = null;
let artistReturnPage: Page = "home";
let albumView: SpotifyAlbumDetails | null = null;
let albumReturnPage: Page = "home";
let filter: SourceFilter = "all";
let libraryQuery = "";
let albumQuery = "";
let sidebarCompact = (() => { try { return localStorage.getItem("maehwa.sidebar-compact.v1") === "true"; } catch { return false; } })();
let sidebarAutoCollapsing = false;
let librarySearchTracks: Track[] = [];
let librarySortMode: LibrarySortMode = "default";
let librarySortOpen = false;
let topSearchQuery = "";
let topSearchTracks: Track[] = [];
let topSearchOpen = false;
let topSearchLoading = false;
let topSearchTargetTrack: string | null = null;
let playlistDialogOpen = false;
let playlistDialogBusy = false;
let playlistDraftName = "";
let playlistDraftPublic = false;
let playlistVisibilityOpen = false;
let spotifyTracks: Track[] = [];
let spotifyPlaylistList: { id: string; name: string; description?: string; owner?: { display_name?: string }; images?: { url: string }[]; tracks?: { total?: number }; public?: boolean | null }[] = [];
let spotifyFollowingList: SpotifyTopArtist[] = [];
let spotifySavedAlbumList: SpotifySavedAlbum[] = [];
let selectedPlaylistId: string | null = null;
let selectedPlaylistTracks: Track[] = [];
let playbackPlaylistName = "내 라이브러리";
let favoritesOnly = false;
let playQueue: Track[] = [];
let shuffleHistory: Track[] = [];
let shuffleHistoryIndex = -1;
let queueOpen = false;
let queueTab: QueueDrawerTab = "queue";
let nowPlayingOpen = false;
let nowPlayingOpening = false;
let lyricsPanelEnabled = false;
let lyricsEntryPending = false;
let lyricsWordMode = true;
let lyricsTrackId = "";
let lyricsLoading = false;
let currentLyrics: TrackLyrics | null = null;
let lyricsError = false;
let activeLyricIndex = -1;
let nowPlayingClosing = false;
let dragFpsFrames = 0;
let dragFpsLastTime = 0;
let dragFpsDisplay: HTMLElement | null = null;
let lyricClockPosition = 0;
let lyricClockAt = 0;
let lyricClockTrackId = "";
let lyricClockPlaying = false;
let lyricsManualScrollUntil = 0;
let lastScrolledLyricIndex = -1;
let nowPlayingWidth = (() => { try { const value = Number(localStorage.getItem("maehwa.now-playing-width.v1")); return Number.isFinite(value) && value >= 280 ? Math.min(520, value) : 380; } catch { return 380; } })();
let libraryView: "tracks" | "albums" = "tracks";
let recentIds: string[] = readRecentTrackIds();
let current: Track | null = null;
let restoredPlaybackPending = false;
let snapshot: PlaybackSnapshot = { current: null, playing: false, position: restoreState.position ?? 0, duration: restoreState.duration ?? 0, volume: restoreState.volume ?? 0.72, shuffle: false, repeat: "off", queue: [] };
let playbackIntent: { playing: boolean; expiresAt: number } | null = null;
let previousVolume = snapshot.volume > 0 ? snapshot.volume : 0.72;
let pendingTrackSelection: { trackId: string; expiresAt: number } | null = null;
let spotifyReady = false;
let lastRenderedPage: Page | undefined;
let navigationHistory: NavigationEntry[] = [];
let navigationHistoryIndex = -1;
const app = document.querySelector<HTMLDivElement>("#app")!;

function currentNavigationEntry(): NavigationEntry {
  return { page, filter, favoritesOnly, selectedPlaylistId, selectedPlaylistTracks: [...selectedPlaylistTracks], albumView, albumReturnPage, activeArtist, activeArtistId, activeArtistProfile, artistProfileError, artistReturnPage };
}

function navigationEntryKey(entry: NavigationEntry): string {
  return [entry.page, entry.filter, entry.favoritesOnly, entry.selectedPlaylistId ?? "", entry.albumView?.id ?? entry.albumView?.name ?? "", entry.activeArtistId || entry.activeArtist].join("|");
}

function syncNavigationHistory(): void {
  const next = currentNavigationEntry();
  if (navigationHistoryIndex >= 0 && navigationEntryKey(navigationHistory[navigationHistoryIndex]) === navigationEntryKey(next)) {
    // Refresh the current entry's cached data without adding another history step.
    // Artist profiles load asynchronously, so the original artist entry may
    // otherwise keep a null profile when navigating back from an album.
    navigationHistory[navigationHistoryIndex] = next;
    return;
  }
  navigationHistory = navigationHistory.slice(0, navigationHistoryIndex + 1);
  navigationHistory.push(next);
  navigationHistoryIndex = navigationHistory.length - 1;
}

function moveNavigationHistory(offset: -1 | 1): void {
  const nextIndex = navigationHistoryIndex + offset;
  const entry = navigationHistory[nextIndex];
  if (!entry) return;
  navigationHistoryIndex = nextIndex;
  page = entry.page;
  filter = entry.filter;
  favoritesOnly = entry.favoritesOnly;
  selectedPlaylistId = entry.selectedPlaylistId;
  selectedPlaylistTracks = [...entry.selectedPlaylistTracks];
  albumView = entry.albumView;
  albumReturnPage = entry.albumReturnPage;
  activeArtist = entry.activeArtist;
  activeArtistId = entry.activeArtistId;
  activeArtistProfile = entry.activeArtistProfile;
  artistProfileError = entry.artistProfileError;
  artistReturnPage = entry.artistReturnPage;
  renderCenterForNavigation();
}

function renderCenterForNavigation(): void {
  syncNavigationHistory();
  const main = app.querySelector<HTMLElement>(".main-content");
  if (!main) return;
  main.innerHTML = pageRenderer.renderPage();
  main.scrollTop = 0;
  lastRenderedPage = page;
  app.querySelectorAll<HTMLElement>(".sidebar [data-page]").forEach((button) => {
    const destination = button.dataset.page as Page | undefined;
    const selected = destination === "library"
      ? page === "library" && button.dataset.filter === filter && !favoritesOnly
      : destination === page;
    button.classList.toggle("selected", selected);
  });
  // Add a direct, non-delegated pointer handler on the play button as a
  // resilient fallback for environments where delegated click events are
  // occasionally dropped (pointer capture, overlays, or timing races).
  try {
    const playBtn = app.querySelector<HTMLButtonElement>("[data-play]");
    if (playBtn && !playBtn.dataset.playFallbackBound) {
      playBtn.dataset.playFallbackBound = "true";
      playBtn.addEventListener("pointerdown", (ev) => {
        ev.stopPropagation();
        // Optimistic immediate UI update to reduce perceived input loss when
        // users click rapidly. We set a short-lived playback intent and
        // flip the UI immediately; the real togglePlay() will perform the
        // actual player operations and correct state if needed.
        try {
          const target = !snapshot.playing;
          playbackIntent = { playing: target, expiresAt: Date.now() + 1800 };
          snapshot = { ...snapshot, playing: target };
          render();
          patchProgress();
        } catch (e) {
          // ignore optimistic update failures
        }
        void togglePlay();
      });
    }
  } catch (err) {
    // Non-fatal — if DOM shape differs, continue without fallback.
    console.warn("play-button fallback binding failed", err);
  }
  app.querySelector<HTMLElement>("[data-favorites]")?.classList.toggle("selected", page === "library" && favoritesOnly);
  const backButton = app.querySelector<HTMLButtonElement>("[data-history-back]");
  const forwardButton = app.querySelector<HTMLButtonElement>("[data-history-forward]");
  if (backButton) backButton.disabled = navigationHistoryIndex <= 0;
  if (forwardButton) forwardButton.disabled = navigationHistoryIndex >= navigationHistory.length - 1;
  bindEvents(true);
  captureNativeTooltips(app);
  markOverflowingAlbumTitles();
}
const spotifySearchDropdown = createSpotifySearchDropdown({
  app,
  query: () => topSearchQuery,
  isOpen: () => topSearchOpen,
  connected: spotifyConnected,
  loading: () => topSearchLoading,
  tracks: () => topSearchTracks,
  targetTrackId: () => topSearchTargetTrack,
  playlists: () => spotifyPlaylistList,
  selectedPlaylistId: () => selectedPlaylistId,
  artMarkup: (track, size) => artMarkup(track, size),
  icon,
});
let nowPlayingPanel!: ReturnType<typeof createNowPlayingPanel>;
const panelSizing = createPanelSizing({
  app,
  nowPlayingOpen: () => nowPlayingOpen,
  closeNowPlaying: () => nowPlayingPanel.close(),
  windowWidth: () => window.innerWidth,
  setSidebarCompactState: (value) => { sidebarCompact = value; },
  setNowPlayingWidthState: (value) => { nowPlayingWidth = value; },
  maxNowPlayingWidth,
  expandedSidebarWidth,
});
const updateSyncedLyrics = createSyncedLyricsUpdater({
  app,
  currentTrackId: () => current?.id,
  lyrics: () => currentLyrics,
  snapshot: () => snapshot,
  clock: () => ({ position: lyricClockPosition, at: lyricClockAt, trackId: lyricClockTrackId, playing: lyricClockPlaying }),
  activeIndex: () => activeLyricIndex,
  setActiveIndex: (index) => { activeLyricIndex = index; },
  lastScrolledIndex: () => lastScrolledLyricIndex,
  setLastScrolledIndex: (index) => { lastScrolledLyricIndex = index; },
  manualScrollUntil: () => lyricsManualScrollUntil,
});
const nowPlayingContent = createNowPlayingContent({
  app,
  current: () => current,
  currentTrackId: () => current?.id,
  lyricsTrackId: () => lyricsTrackId,
  lyrics: () => currentLyrics,
  lyricsLoading: () => lyricsLoading,
  lyricsError: () => lyricsError,
  lyricsWordMode: () => lyricsWordMode,
  playlistName: () => playbackPlaylistName,
  queue: () => playQueue,
  favoriteIds: () => favoriteIds,
  lyricsEnabled: () => lyricsPanelEnabled,
  artMarkup,
  artistLabel,
  icon,
  toggleFavorite: (id) => { void toggleFavorite(id); },
  updateSyncedLyrics,
});
nowPlayingPanel = createNowPlayingPanel({
  app,
  windowWidth: () => window.innerWidth,
  sidebarCompact: () => sidebarCompact,
  sidebarAutoCollapsing: () => sidebarAutoCollapsing,
  setSidebarAutoCollapsing: (value) => { sidebarAutoCollapsing = value; },
  setSidebarCompact: (value) => setSidebarCompact(value),
  nowPlayingWidth: () => nowPlayingWidth,
  maxNowPlayingWidth,
  setNowPlayingOpen: (value) => { nowPlayingOpen = value; },
  setNowPlayingOpening: (value) => { nowPlayingOpening = value; },
  nowPlayingClosing: () => nowPlayingClosing,
  setNowPlayingClosing: (value) => { nowPlayingClosing = value; },
  setQueueOpen: (value) => { queueOpen = value; },
  renderPanel: (queue) => queue ? renderQueuePanel() : nowPlayingContent.renderPanel(),
  bindPanelEvents: bindNowPlayingPanelEvents,
  bindPanelResizer: bindPanelResizerForPanel,
  afterPanelChange: refreshNowPlayingLayout,
});

function bindNowPlayingPanelEvents(panel: HTMLElement): void {
  if (panel.dataset.panelEventsBound === "true") return;
  panel.dataset.panelEventsBound = "true";
  panel.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-queue-close]")) {
      nowPlayingPanel.showQueue(false);
      return;
    }
    const queueTab = target.closest<HTMLElement>("[data-queue-tab]");
    if (queueTab?.dataset.queueTab === "queue" || queueTab?.dataset.queueTab === "recent") {
      if (queueTab.getAttribute("aria-selected") === "true") return;
      queueTabValue(queueTab.dataset.queueTab);
      updateQueuePanelContent(panel);
      return;
    }
    const queuedTrack = target.closest<HTMLElement>("[data-queue-play]");
    if (queuedTrack) {
      const recent = queuedTrack.dataset.queueKind === "recent";
      const sourceTracks = recent ? resolveRecentTracks(recentIds, tracks, 30) : playQueue;
      const track = sourceTracks.find((item) => item.id === queuedTrack.dataset.queuePlay);
      if (track) void playTrack(track, recent ? [track] : playQueue);
      return;
    }
    if (target.closest("[data-like]")) {
      const track = current;
      if (track) void toggleFavorite(track.id);
    }
  });
  updateQueueTabIndicator(panel);
}

function queueTabValue(value: string | undefined): void {
  if (value === "queue" || value === "recent") queueTab = value;
}

function updateQueueTabIndicator(panel: HTMLElement): void {
  const tabList = panel.querySelector<HTMLElement>(".queue-heading [role=tablist]");
  const selectedTab = tabList?.querySelector<HTMLElement>('[data-queue-tab][aria-selected="true"]');
  const indicator = tabList?.querySelector<HTMLElement>(".queue-tab-indicator");
  if (!tabList || !selectedTab || !indicator) return;
  indicator.style.width = `${selectedTab.offsetWidth}px`;
  indicator.style.transform = `translateX(${selectedTab.offsetLeft}px)`;
}

function updateQueuePanelContent(panel: HTMLElement): void {
  const template = document.createElement("template");
  template.innerHTML = renderQueuePanel();
  const nextContent = template.content.querySelector<HTMLElement>(".queue-content");
  const content = panel.querySelector<HTMLElement>(".queue-content");
  if (!nextContent || !content) return;
  panel.querySelectorAll<HTMLElement>("[data-queue-tab]").forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.queueTab === queueTab));
  });
  updateQueueTabIndicator(panel);
  content.innerHTML = nextContent.innerHTML;
  refreshNowPlayingLayout();
}

function bindPanelResizerForPanel(resizer: HTMLElement): void {
  panelControls.bindPanelResizer(resizer);
}

function refreshNowPlayingLayout(): void {
  captureNativeTooltips(app);
  markOverflowingAlbumTitles();
  observeResponsiveLayout(app, panelControls.isResizingPanel, markOverflowingAlbumTitles);
  void ensureLyricsLoaded();
}

function renderArtistCenter(preserveScroll = false): void {
  const main = app.querySelector<HTMLElement>(".main-content");
  if (!main) return;
  const scrollTop = preserveScroll ? main.scrollTop : 0;
  main.innerHTML = pageRenderer.renderPage();
  main.scrollTop = scrollTop;
  lastRenderedPage = page;
  syncNavigationHistory();
  captureNativeTooltips(app);
  markOverflowingAlbumTitles();
  main.querySelector<HTMLElement>("[data-artist-back]")?.addEventListener("click", () => {
    page = artistReturnPage;
    render();
  });
}

function openArtistProfileView(name: string, id: string): void {
  const artist = name.trim();
  if (!artist) return;
  if (page !== "artist") artistReturnPage = page;
  activeArtist = artist;
  activeArtistId = id;
  activeArtistProfile = null;
  artistProfileLoading = true;
  artistProfileError = "";
  page = "artist";
  const requestId = ++artistProfileRequest;
  renderArtistCenter();
  void spotifyArtistProfile(artist, id || undefined).then((profile) => {
    if (page !== "artist" || artistProfileRequest !== requestId) return;
    activeArtistProfile = profile;
    artistProfileLoading = false;
    renderArtistCenter(true);
  }).catch((error: unknown) => {
    if (page !== "artist" || artistProfileRequest !== requestId) return;
    artistProfileLoading = false;
    artistProfileError = error instanceof Error ? error.message : "Spotify 아티스트 정보를 불러오지 못했습니다.";
    renderArtistCenter(true);
  });
}

async function openSavedAlbumView(id: string): Promise<void> {
  const requestId = ++savedAlbumRequest;
  const returnPage = page === "album" ? albumReturnPage : page;
  try {
    const album = await spotifyAlbumTracks(id);
    if (requestId !== savedAlbumRequest) return;
    albumReturnPage = returnPage;
    albumQuery = "";
    albumView = album;
    page = "album";
    const main = app.querySelector<HTMLElement>(".main-content");
    if (main) {
      main.innerHTML = pageRenderer.renderPage();
      lastRenderedPage = "album";
      syncNavigationHistory();
      bindEvents(true);
    }
  } catch (error) {
    if (requestId !== savedAlbumRequest) return;
    showNotice(error instanceof Error ? `저장한 앨범을 열지 못했습니다: ${error.message}` : "저장한 앨범을 열지 못했습니다.");
  }
}

async function openArtistAlbumView(id: string): Promise<void> {
  if (!id) return;
  const requestId = ++savedAlbumRequest;
  const returnPage = page === "album" ? albumReturnPage : page;
  try {
    const album = await spotifyAlbumTracks(id);
    if (requestId !== savedAlbumRequest) return;
    albumReturnPage = returnPage;
    albumQuery = "";
    albumView = album;
    page = "album";
    const main = app.querySelector<HTMLElement>(".main-content");
    if (main) {
      main.innerHTML = pageRenderer.renderPage();
      lastRenderedPage = "album";
      syncNavigationHistory();
      bindEvents(true);
    }
  } catch (error) {
    if (requestId !== savedAlbumRequest) return;
    showNotice(error instanceof Error ? `앨범을 열지 못했습니다: ${error.message}` : "앨범을 열지 못했습니다.");
  }
}
const lyricsUi = createLyricsUi({
  app,
  renderLyrics: nowPlayingContent.renderLyrics,
  enabled: () => lyricsPanelEnabled,
  takeEntryPending: () => {
    if (!lyricsEntryPending) return false;
    lyricsEntryPending = false;
    return true;
  },
  resetSync: () => { activeLyricIndex = -1; lastScrolledLyricIndex = -1; },
  updateSyncedLyrics,
});
const lyricsLoader = createLyricsLoader({
  enabled: () => lyricsPanelEnabled,
  panelOpen: () => nowPlayingOpen,
  current: () => current,
  trackId: () => lyricsTrackId,
  setTrackId: (id) => { lyricsTrackId = id; },
  isLoading: () => lyricsLoading,
  loading: (value) => { lyricsLoading = value; },
  lyrics: () => currentLyrics,
  setLyrics: (lyrics) => { currentLyrics = lyrics; },
  hasError: () => lyricsError,
  setError: (value) => { lyricsError = value; },
  resetActiveIndex: () => { activeLyricIndex = -1; },
  findLyrics,
  updateCard: () => lyricsUi.updateCard(),
});
const currentTrackUi = createCurrentTrackUi({
  app,
  current: () => current,
  snapshot: () => snapshot,
  favoriteIds: () => favoriteIds,
  lyricsEnabled: () => lyricsPanelEnabled,
  nowPlayingOpen: () => nowPlayingOpen,
  queuePanelOpen: () => queueOpen,
  setLyricsEntryPending: (pending) => { lyricsEntryPending = pending; },
  artistLabel,
  artMarkup,
  icon,
  replaceWithMarkup,
  refreshNowPlayingPanel: nowPlayingContent.refreshPanel,
  refreshQueuePanel: () => nowPlayingPanel.showQueue(true),
  animateLyricsCardIn: (card) => lyricsUi.animateCardIn(card),
  patchTrackRowPlaybackState,
  patchAlbumCardPlaybackState,
  patchProgress,
  refreshAmbientArtwork,
  ensureLyricsLoaded: () => { void ensureLyricsLoaded(); },
});
const progressController = createProgressController({
  app,
  current: () => current,
  snapshot: () => snapshot,
  restoreState: () => restoreState,
  setRestoreState: (state) => { restoreState = state; },
  patchTrackRows: patchTrackRowPlaybackState,
  patchAlbumCards: patchAlbumCardPlaybackState,
  setLyricClock: (playback, track, now) => {
    lyricClockPosition = playback.position;
    lyricClockAt = now;
    lyricClockTrackId = track?.id ?? "";
    lyricClockPlaying = playback.playing;
  },
  icon,
  updateSyncedLyrics,
  persistPlayback,
});
const resolveCurrentAlbum = createCurrentAlbumResolver({
  tracks: () => tracks,
  spotifyTracks: () => spotifyTracks,
  selectedPlaylistTracks: () => selectedPlaylistTracks,
  playQueue: () => playQueue,
  albumGroupingKey,
});
const togglePlayback = createTogglePlay({
  current: () => current,
  snapshot: () => snapshot,
  setSnapshot: (value) => { snapshot = value; },
  playbackIntent: () => playbackIntent,
  setPlaybackIntent: (value) => { playbackIntent = value; },
  restoredPlaybackPending: () => restoredPlaybackPending,
  setRestoredPlaybackPending: (value) => { restoredPlaybackPending = value; },
  spotifyReady: () => spotifyReady,
  connectSpotify: () => connectSpotify(),
  queue: () => playQueue,
  firstTrack: () => tracks[0],
  playTrack,
  addFolder,
  localPlayer,
  spotifyPlayer,
  patchProgress,
  showNotice,
});
const trackPlayback = createTrackPlayback({
  current: () => current,
  setCurrent: (value) => { current = value; },
  snapshot: () => snapshot,
  setSnapshot: (value) => { snapshot = value; },
  tracks: () => tracks,
  playQueue: () => playQueue,
  setPlayQueue: (value) => { playQueue = value; },
  selectedPlaylistId: () => selectedPlaylistId,
  selectedPlaylistTracks: () => selectedPlaylistTracks,
  playlistName: (id) => spotifyPlaylistList.find((playlist) => playlist.id === id)?.name,
  playbackPlaylistId: () => playbackPlaylistId,
  setPlaybackPlaylistId: (value) => { playbackPlaylistId = value; },
  setPlaybackPlaylistName: (value) => { playbackPlaylistName = value; },
  restoreState: () => restoreState,
  setRestoreState: (value) => { restoreState = value; },
  setRestoredPlaybackPending: (value) => { restoredPlaybackPending = value; },
  setPendingTrackSelection: (value) => { pendingTrackSelection = value; },
  pendingTrackSelection: () => pendingTrackSelection,
  recordRecentTrack: (trackId) => { recentIds = recordRecentTrack(recentIds, trackId); },
  isSpotifyReady: () => spotifyReady,
  connectSpotify: () => connectSpotify(),
  localPlayer,
  spotifyPlayer,
  persistPlayback,
  patchCurrentTrackUi: () => currentTrackUi.patchCurrentTrackUi(),
  showNotice,
});
const spotifyAutoAdvance = createSpotifyAutoAdvance({
  current: () => current,
  snapshot: () => snapshot,
  setSnapshot: (value) => { snapshot = value; },
  restoreVolume: () => restoreState.volume,
  queue: () => playQueue,
  autoAdvanceLock: () => spotifyAutoAdvanceLock,
  setAutoAdvanceLock: (value) => { spotifyAutoAdvanceLock = value; },
  resolvePlaybackIntent,
  nextTrack,
  patchProgress,
  playbackIntent: () => playbackIntent,
});
const restorePlayback = createPlaybackRestore({
  tracks: () => tracks,
  restoreState: () => restoreState,
  snapshot: () => snapshot,
  setSnapshot: (value) => { snapshot = value; },
  setCurrent: (value) => { current = value; },
  setRestorePending: (value) => { restoredPlaybackPending = value; },
  setQueue: (value) => { playQueue = value; },
  localPlayer,
});
const bootLibrary = createLibraryBoot({
  tracks: () => tracks,
  setTracks: (value) => { tracks = value; },
  folders: () => folders,
  spotifyTracks: () => spotifyTracks,
  mergeTracks,
  setPlayerTracks: (value) => localPlayer.setTracks(value),
  setIntroStatus,
  restorePlayback,
  render,
  dismissIntro,
  spotifyConnected,
  refreshSpotifyLibrary: () => refreshSpotifyLibrary(),
});
const localImport = createLocalImport({
  tracks: () => tracks,
  setTracks: (value) => { tracks = value; },
  folders: () => folders,
  setFolders: (value) => { folders = value; },
  spotifyTracks: () => spotifyTracks,
  mergeTracks,
  persistLibrary,
  setPlayerTracks: (value) => localPlayer.setTracks(value),
  showNotice,
  setLibraryPage: () => { page = "library"; filter = "local"; favoritesOnly = false; },
  render,
});
const librarySearchController = createLibrarySearch({
  query: () => libraryQuery,
  setTracks: (value) => { librarySearchTracks = value; },
  render,
  getInput: () => app.querySelector<HTMLInputElement>("#library-search"),
});
const spotifySearchController = createSpotifySearch({
  query: () => topSearchQuery,
  connected: spotifyConnected,
  setTracks: (value) => { topSearchTracks = value; },
  setLoading: (value) => { topSearchLoading = value; },
  paint: spotifySearchDropdown.paint,
  showNotice,
});
const playTopSearchResult = createPlaySearchResult({
  tracks: () => topSearchTracks,
  closeSearch: () => { topSearchOpen = false; },
  render,
  playTrack: (track, queue, context) => playTrack(track, queue, context),
});
const loadPlaylist = createPlaylistLoader({
  likedTracks: () => spotifyTracks,
  setSelectedPlaylistId: (value) => { selectedPlaylistId = value; },
  setSelectedPlaylistTracks: (value) => { selectedPlaylistTracks = value; },
  setLibraryQuery: (value) => { libraryQuery = value; },
  setFavoritesOnly: (value) => { favoritesOnly = value; },
  setFilter: (value) => { filter = value; },
  setPage: (value) => { page = value; },
  setPlayQueue: (value) => { playQueue = value; },
  setPlaybackPlaylistName: (value) => { playbackPlaylistName = value; },
  render: renderPlaylistSelection,
  scrollToCurrentTrack,
  showNotice,
});
const ensurePlaylistWriteScope = createPlaylistPermissionCheck({
  connected: spotifyConnected,
  hasWriteScope: spotifyHasPlaylistWriteScope,
  login: loginSpotify,
  showNotice,
});
const addSearchTrackToPlaylist = createAddSearchTrack({
  searchTracks: () => topSearchTracks,
  selectedPlaylistId: () => selectedPlaylistId,
  selectedPlaylistTracks: () => selectedPlaylistTracks,
  setSelectedPlaylistTracks: (value) => { selectedPlaylistTracks = value; },
  playlists: () => spotifyPlaylistList,
  setPlaylists: (value) => { spotifyPlaylistList = value; },
  setTargetTrackId: (value) => { topSearchTargetTrack = value; },
  ensureWriteScope: ensurePlaylistWriteScope,
  paintSearchDropdown: spotifySearchDropdown.paint,
  isLibraryPage: () => page === "library",
  render,
  showNotice,
});
const createSpotifyPlaylist = createSpotifyPlaylistCreator({
  isBusy: () => playlistDialogBusy,
  setBusy: (value) => { playlistDialogBusy = value; },
  disableSubmit: () => {
    const submit = app.querySelector<HTMLButtonElement>("[data-playlist-form] [type=submit]");
    if (submit) { submit.disabled = true; submit.textContent = "만드는 중…"; }
  },
  ensureWriteScope: ensurePlaylistWriteScope,
  addPlaylist: (playlist) => { spotifyPlaylistList = [playlist, ...spotifyPlaylistList.filter((item) => item.id !== playlist.id)]; },
  selectPlaylist: (playlist) => {
    selectedPlaylistId = playlist.id;
    selectedPlaylistTracks = [];
    filter = "spotify";
    favoritesOnly = false;
    page = "library";
    playlistDialogOpen = false;
    playlistDraftName = "";
    playQueue = [];
  },
  render,
  showNotice,
});
const refreshSpotifyLibrary = createSpotifyLibraryRefresh({
  folders: () => folders,
  tracks: () => tracks,
  setSpotifyTracks: (value) => { spotifyTracks = value; },
  setTracks: (value) => { tracks = value; },
  setSpotifyPlaylistList: (value) => { spotifyPlaylistList = value; },
  setSpotifyFollowingArtists: (value) => { spotifyFollowingList = value; },
  setSpotifySavedAlbums: (value) => { spotifySavedAlbumList = value; },
  mergeTracks,
  persistLibrary,
  showNotice,
});
const spotifyConnection = createSpotifyConnection({
  isReady: () => spotifyReady,
  setReady: (value) => { spotifyReady = value; },
  isConnected: spotifyConnected,
  player: spotifyPlayer,
  onPlaybackUpdate: spotifyAutoAdvance,
  initialVolume: () => restoreState.volume ?? snapshot.volume,
  refreshLibrary: refreshSpotifyLibrary,
  loadLikedSongs: (switchPage) => loadPlaylist("liked-songs", false, switchPage),
  setSpotifyLibraryPage: () => { page = "library"; filter = "spotify"; },
  render,
  showNotice,
});
const disconnectSpotifyAccount = createSpotifyDisconnect({
  disconnect: disconnectSpotify,
  destroyPlayer: () => spotifyPlayer.destroy(),
  setReady: (value) => { spotifyReady = value; },
  setSpotifyTracks: (value) => { spotifyTracks = value; },
  tracks: () => tracks,
  setTracks: (value) => { tracks = value; },
  folders: () => folders,
  persistLibrary,
  render,
  showNotice,
});
const spotifyViewerSync = createSpotifyViewerSync({
  current: () => current,
  setCurrent: (value) => { current = value; },
  pendingTrackSelection: () => pendingTrackSelection,
  setPendingTrackSelection: (value) => { pendingTrackSelection = value; },
  setPlaybackPlaylistName: (value) => { playbackPlaylistName = value; },
  sameTrackId,
  resolvePlaybackIntent,
  snapshot: () => snapshot,
  setSnapshot: (value) => { snapshot = value; },
  patchCurrentTrackUi: () => currentTrackUi.patchCurrentTrackUi(),
  patchProgress,
  playbackIntent: () => playbackIntent,
});
const playbackControls = createPlaybackControls({
  current: () => current,
  snapshot: () => snapshot,
  setSnapshot: (value) => { snapshot = value; },
  queue: () => playQueue,
  shuffleHistory: () => shuffleHistory,
  setShuffleHistory: (value) => { shuffleHistory = value; },
  shuffleHistoryIndex: () => shuffleHistoryIndex,
  setShuffleHistoryIndex: (value) => { shuffleHistoryIndex = value; },
  restoreState: () => restoreState,
  setRestoreState: (value) => { restoreState = value; },
  previousVolume: () => previousVolume,
  setPreviousVolume: (value) => { previousVolume = value; },
  localPlayer,
  spotifyPlayer,
  playTrack,
  patchProgress,
  patchPlaybackModes,
  persistPlayback,
  showNotice,
  sameTrackId,
});
const metadataRepair = createMetadataRepair({
  getCurrentTrack: () => current,
  isTauriRuntime,
  render,
  showNotice,
  onApplied(updated) {
    const isMatch = (track: Track | null | undefined) => track && (track.id === updated.id || (track.localPath && updated.localPath && track.localPath === updated.localPath));
    tracks = tracks.map((track) => isMatch(track) ? { ...track, ...updated } : track);
    favoriteTracks = favoriteTracks.map((track) => isMatch(track) ? { ...track, ...updated } : track);
    playQueue = playQueue.map((track) => isMatch(track) ? { ...track, ...updated } : track);
    if (isMatch(current)) {
      current = { ...current!, ...updated };
      snapshot = { ...snapshot, current };
      restoreState = { ...restoreState, track: current };
      persistPlayback();
      localPlayer.updateCurrentTrack(updated);
    }
    persistLibrary(folders, tracks);
    saveFavoriteTracks(favoriteTracks);
  }
});
initCustomScrollbars(app);
const introController = createIntroController({ app, refreshScrollbars: refreshCustomScrollbars });
const noticeController = createNoticeController();
const brandLogo = new URL("../아이콘/MaeHwa_Melo_icon_1024_transparent.png", import.meta.url).href;
const spotifyIconAsset = new URL("../아이콘/스포티파이/icon-square.svg", import.meta.url).href;

function setIntroStatus(text: string): void { introController.setStatus(text); }
function dismissIntro(): void { introController.dismiss(); }

bindLocalPlayerEvents({
  localPlayer,
  current: () => current,
  snapshot: () => snapshot,
  queue: () => playQueue,
  shuffleHistory: () => shuffleHistory,
  shuffleHistoryIndex: () => shuffleHistoryIndex,
  seek,
  nextTrack,
  playbackIntent: () => playbackIntent,
  onSnapshot(value) {
    console.debug("[bindLocalPlayerEvents:onSnapshot] received", value);
    if (current?.source === "spotify") return;
    const changed = value.current?.id !== current?.id;
    snapshot = { ...value, volume: restoreState.volume ?? value.volume, playing: resolvePlaybackIntent(value.playing) };
    current = value.current;
    if (changed) currentTrackUi.patchCurrentTrackUi(); else patchProgress();
  },
});
window.addEventListener("maehwa:notice", (event) => showNotice((event as CustomEvent<string>).detail));
window.addEventListener("keydown", (event) => {
  if ((event.target as HTMLElement | null)?.matches("input,textarea")) return;
  if (event.code === "Space") { event.preventDefault(); void togglePlay(); }
  if (event.key === "ArrowRight" && current) void seek(snapshot.position + 5);
  if (event.key === "ArrowLeft" && current) void seek(snapshot.position - 5);
});

function showNotice(message: string): void { noticeController.show(message); }

const libraryTrackSelectors = createLibraryTrackSelectors({
  groups: () => [tracks, spotifyTracks, favoriteTracks, current ? [current] : [], playQueue, librarySearchTracks, topSearchTracks],
  favoriteIds: () => favoriteIds,
  mergeTracks,
  selectionState: () => ({ page, selectedPlaylistId, selectedPlaylistTracks, favoritesOnly, filter }),
  tracks: () => tracks,
});
const { favoriteTrackList, activeTracks } = libraryTrackSelectors;

const pageRenderer = createPageRenderer({
  page: () => page,
  artist: () => activeArtist,
  artistProfile: () => activeArtistProfile,
  artistProfileLoading: () => artistProfileLoading,
  artistProfileError: () => artistProfileError,
  album: () => albumView,
  albumQuery: () => albumQuery,
  libraryQuery: () => libraryQuery,
  libraryView: () => libraryView,
  sortMode: () => librarySortMode,
  sortOpen: () => librarySortOpen,
  current: () => current,
  snapshot: () => snapshot,
  tracks: () => tracks,
  favoriteIds: () => favoriteIds,
  recentIds: () => recentIds,
  folders: () => folders,
  filter: () => filter,
  selectedPlaylistId: () => selectedPlaylistId,
  selectedPlaylistTracks: () => selectedPlaylistTracks,
  favoritesOnly: () => favoritesOnly,
  playlists: () => spotifyPlaylistList,
  sortLibraryTracks,
  activeTracks,
  spotifyConnected,
  spotifyReady: hasSpotifyClientId,
  icon,
});
const openAlbumPage = createOpenAlbumPage({
  current: () => current,
  page: () => page,
  setPage: (value) => { page = value; },
  albumReturnPage: () => albumReturnPage,
  setAlbumReturnPage: (value) => { albumReturnPage = value; },
  setAlbumQuery: (value) => { albumQuery = value; },
  setAlbum: (value) => { albumView = value; },
  resolveAlbum: resolveCurrentAlbum,
  mainContent: () => app.querySelector<HTMLElement>(".main-content"),
  renderPage: pageRenderer.renderPage,
  setLastRenderedPage: (value) => { lastRenderedPage = value; syncNavigationHistory(); },
  bindEvents,
  showNotice,
});
const panelControls = createWindowAndPanelControls({
  app,
  isTauriRuntime,
  isSidebarCompact: () => sidebarCompact,
  setSidebarCompact,
  getNowPlayingWidth: () => nowPlayingWidth,
  setNowPlayingWidth: (width, persist) => setNowPlayingWidth(width, persist),
  markOverflowingTitles: markOverflowingAlbumTitles,
});
function renderQueuePanel(): string {
  return queueOpen ? renderQueueDrawer({
    tab: queueTab,
    current,
    playlistName: playbackPlaylistName,
    upcoming: (() => {
      const index = currentQueueIndex(current, playQueue);
      return index >= 0 ? playQueue.slice(index + 1) : [];
    })(),
    recent: resolveRecentTracks(recentIds, tracks, 30),
    artMarkup,
    artistLabel,
  }) : "";
}
const renderLifecycle = createRenderLifecycle({
  app,
  hideTooltip: hideCustomTooltip,
  pageKey: () => page,
  lastRenderedPage: () => lastRenderedPage,
  setLastRenderedPage: (value) => { lastRenderedPage = value as Page; },
  nowPlayingOpen: () => nowPlayingOpen,
  queuePanelOpen: () => queueOpen,
  nowPlayingClosing: () => nowPlayingClosing,
  renderNowPlayingPanel: nowPlayingContent.renderPanel,
  renderQueueDrawer: renderQueuePanel,
  bindPanelEvents: bindNowPlayingPanelEvents,
  captureTooltips: captureNativeTooltips,
  markOverflowingTitles: markOverflowingAlbumTitles,
  lyricsEnabled: () => lyricsPanelEnabled,
  lyricsEntryPending: () => lyricsEntryPending,
  animateLyricsCardIn: (card) => lyricsUi.animateCardIn(card),
  observeResponsiveLayout: () => observeResponsiveLayout(app, panelControls.isResizingPanel, markOverflowingAlbumTitles),
  isOpening: () => nowPlayingOpening,
  setNowPlayingOpening: (value) => { nowPlayingOpening = value; },
  bindEvents,
  refreshArtwork: () => refreshAmbientArtwork(current?.artwork),
  patchProgress,
  ensureLyricsLoaded: () => { void ensureLyricsLoaded(); },
});

function render(): void {
  syncNavigationHistory();
  const beforeRender = renderLifecycle.begin();
  app.innerHTML = renderAppShell({
    current,
    page,
    canNavigateBack: navigationHistoryIndex > 0,
    canNavigateForward: navigationHistoryIndex >= 0 && navigationHistoryIndex < navigationHistory.length - 1,
    filter,
    favoritesOnly,
    favoriteCount: favoriteTrackList().length,
    topSearchOpen,
    topSearchQuery,
    nowPlayingOpen,
    nowPlayingOpening,
    nowPlayingWidth,
    sidebarCompact,
    sidebarAutoCollapsing,
    expandedSidebarWidth: expandedSidebarWidth(),
    maxNowPlayingWidth: maxNowPlayingWidth(),
    snapshot,
    lyricsEnabled: lyricsPanelEnabled,
    favoriteIds,
    sidebarPlaylists: renderSpotifySidebarPlaylists(),
    mainPage: pageRenderer.renderPage(),
    searchResults: spotifySearchDropdown.render(),
    metadataDialog: metadataRepair.renderDialog(),
    playlistDialog: playlistDialogOpen ? renderPlaylistDialog() : "",
    brandLogo,
    spotifyIconAsset,
    spotifyConnected: spotifyConnected(),
    spotifyReady: hasSpotifyClientId(),
    icon,
    artMarkup,
    artistLabel,
  });
  renderLifecycle.finish(beforeRender.scrollTop, beforeRender.existingNowPlayingSlot);
  const mainContent = app.querySelector<HTMLElement>(".main-content");
  if (mainContent) {
    const updatePlaylistStickyCover = (): void => {
      const cover = mainContent.querySelector<HTMLElement>("[data-playlist-cover-enlarge]");
      const sticky = mainContent.querySelector<HTMLElement>("[data-playlist-sticky-cover]");
      if (!cover || !sticky) return;
      if (sticky.dataset.paletteReady !== "true") {
        sticky.dataset.paletteReady = "true";
        const source = new Image();
        source.crossOrigin = "anonymous";
        source.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = 32;
            canvas.height = 32;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            if (!context) return;
            context.drawImage(source, 0, 0, canvas.width, canvas.height);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            const groups = [
              { r: 0, g: 0, b: 0, n: 0 },
              { r: 0, g: 0, b: 0, n: 0 },
              { r: 0, g: 0, b: 0, n: 0 },
            ];
            let all = { r: 0, g: 0, b: 0, n: 0 };
            for (let i = 0; i < pixels.length; i += 16) {
              const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
              const max = Math.max(r, g, b), min = Math.min(r, g, b);
              if (pixels[i + 3] < 128 || max < 48 || max - min < 18) continue;
              const index = max === r ? 0 : max === g ? 1 : 2;
              groups[index].r += r; groups[index].g += g; groups[index].b += b; groups[index].n++;
              all.r += r; all.g += g; all.b += b; all.n++;
            }
            const colors = groups.map((group) => {
              const value = group.n ? group : all;
              const count = value.n || 1;
              return `rgb(${Math.round(value.r / count)}, ${Math.round(value.g / count)}, ${Math.round(value.b / count)})`;
            });
            sticky.style.setProperty("--playlist-color-a", colors[0]);
            sticky.style.setProperty("--playlist-color-b", colors[1]);
            sticky.style.setProperty("--playlist-color-c", colors[2]);
          } catch {
            // Cross-origin Spotify covers may deny canvas reads; keep the neutral fallback palette.
          }
        };
        source.src = sticky.dataset.playlistCoverUrl ?? "";
      }
      const mainTop = mainContent.getBoundingClientRect().top;
      sticky.classList.toggle("is-visible", cover.getBoundingClientRect().bottom <= mainTop + 12);
    };
    mainContent.addEventListener("scroll", updatePlaylistStickyCover, { passive: true });
    updatePlaylistStickyCover();
  }
}

function clearPlaylistSelection(): void {
  selectedPlaylistId = null;
  selectedPlaylistTracks = [];
}

function renderSpotifySidebarPlaylists(): string {
  return renderSpotifySidebarPlaylistsMarkup({ page, filter, favoritesOnly, connected: spotifyConnected(), selectedPlaylistId, playlists: spotifyPlaylistList, followingArtists: spotifyFollowingList, savedAlbums: spotifySavedAlbumList, icon });
}

function renderPlaylistSelection(): void {
  syncNavigationHistory();
  const main = app.querySelector<HTMLElement>(".main-content");
  if (!main) {
    render();
    return;
  }

  const scrollTop = main.scrollTop;
  main.innerHTML = pageRenderer.renderPage();
  main.scrollTop = scrollTop;
  lastRenderedPage = page;

  app.querySelectorAll<HTMLElement>(".sidebar [data-playlist]").forEach((element) => {
    const wrapper = element.closest<HTMLElement>(".spotify-sidebar-playlist");
    wrapper?.classList.toggle("selected", element.dataset.playlist === selectedPlaylistId);
  });
  app.querySelectorAll<HTMLElement>(".sidebar [data-page]").forEach((button) => {
    const destination = button.dataset.page as Page | undefined;
    const selected = destination === "library"
      ? page === "library" && button.dataset.filter === filter && !favoritesOnly
      : destination === page;
    button.classList.toggle("selected", selected);
  });
  app.querySelector(".sidebar [data-favorites]")?.classList.toggle("selected", page === "library" && favoritesOnly);

  const backButton = app.querySelector<HTMLButtonElement>("[data-history-back]");
  const forwardButton = app.querySelector<HTMLButtonElement>("[data-history-forward]");
  if (backButton) backButton.disabled = navigationHistoryIndex <= 0;
  if (forwardButton) forwardButton.disabled = navigationHistoryIndex < 0 || navigationHistoryIndex >= navigationHistory.length - 1;

  bindEvents(true);
  refreshCustomScrollbars(app);
  captureNativeTooltips(app);
  markOverflowingAlbumTitles();
  observeResponsiveLayout(app, panelControls.isResizingPanel, markOverflowingAlbumTitles);
  main.dispatchEvent(new Event("scroll"));
}

function sortLibraryTracks(items: Track[], enabled: boolean): Track[] {
  return sortLibraryTracksByMode(items, enabled, librarySortMode);
}

function markOverflowingAlbumTitles(): void { markOverflowingTitlesInRoot(app); }

function patchAlbumCardPlaybackState(): void {
  patchAlbumCards({ app, current, snapshot, icon, albumPlaybackStatus: (playing) => albumPlaybackStatus(playing, icon) });
}

function scrollToCurrentTrack(): void {
  const currentTrackId = current?.id;
  if (!currentTrackId || !selectedPlaylistTracks.some((track) => track.id === currentTrackId)) {
    window.requestAnimationFrame(() => {
      app.querySelector<HTMLElement>(".main-content")?.scrollTo({ top: 0, behavior: "smooth" });
    });
    return;
  }
  scrollToTrack(app, currentTrackId);
}

function patchTrackRowPlaybackState(): void {
  patchTrackRows({ app, current, snapshot, icon, albumPlaybackStatus: () => "" });
}

function openCurrentAlbum(): Promise<void> { return openAlbumPage(); }

function closeAlbumCoverOverlay(): void {
  const overlay = app.querySelector<HTMLElement>("[data-album-cover-overlay]");
  if (!overlay) return;
  if (overlay.dataset.closing === "true") return;
  const finishClose = (): void => {
    overlay.remove();
    albumCoverFocusTarget?.focus();
    albumCoverFocusTarget = null;
  };
  const cover = albumCoverFocusTarget;
  const image = overlay.querySelector<HTMLImageElement>(".album-cover-zoom img");
  if (!cover?.isConnected || !image || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    finishClose();
    return;
  }
  const from = overlay.querySelector<HTMLElement>(".album-cover-zoom")?.getBoundingClientRect() ?? image.getBoundingClientRect();
  const to = cover.getBoundingClientRect();
  if (!from.width || !to.width) { finishClose(); return; }
  overlay.dataset.closing = "true";
  overlay.querySelectorAll<HTMLElement>(".album-cover-overlay-backdrop, .album-cover-zoom").forEach((element) => { element.style.pointerEvents = "none"; });
  const translateX = to.left + to.width / 2 - (from.left + from.width / 2);
  const translateY = to.top + to.height / 2 - (from.top + from.height / 2);
  const scaleX = to.width / from.width;
  const scaleY = to.height / from.height;
  const animation = overlay.animate(
    [
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0, transform: `translate3d(${translateX}px,${translateY}px,0) scale(${scaleX},${scaleY})` },
    ],
    { duration: 230, easing: "cubic-bezier(.32,.72,.28,1)", fill: "forwards" },
  );
  void animation.finished.then(finishClose, finishClose);
}

function showCoverOverlay(artwork: string, coverTitle: string, cover: HTMLElement | null): void {
  if (!artwork || app.querySelector("[data-album-cover-overlay]")) return;
  const overlay = document.createElement("div");
  overlay.className = "album-cover-overlay";
  overlay.dataset.albumCoverOverlay = "true";
  albumCoverFocusTarget = document.activeElement instanceof HTMLElement ? document.activeElement : cover;
  const title = esc(coverTitle);
  overlay.innerHTML = `<img class="album-cover-backdrop-art" src="${esc(safeUrl(artwork))}" alt="" aria-hidden="true"><div class="album-cover-color-glow" aria-hidden="true"></div><button class="album-cover-overlay-backdrop" type="button" data-cover-overlay-close aria-label="커버 크게 보기 닫기"></button><div class="album-cover-zoom" role="dialog" aria-modal="true" aria-label="${title} 커버" tabindex="-1"><img src="${esc(safeUrl(artwork))}" alt="${title} 커버"><span class="album-cover-light-shadow" aria-hidden="true"></span><span class="album-cover-reflection" aria-hidden="true"></span><span class="album-cover-reflection-edge" aria-hidden="true"></span><strong>${title}</strong></div>`;
  const zoomCard = overlay.querySelector<HTMLElement>(".album-cover-zoom");
  const coverImage = zoomCard?.querySelector<HTMLImageElement>("img");
  const sampleCoverColors = (source: CanvasImageSource, width: number, height: number): boolean => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 24;
      canvas.height = 24;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return false;
      context.drawImage(source, 0, 0, width, height, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const samples: { r: number; g: number; b: number; weight: number }[] = [];
      for (let i = 0; i < pixels.length; i += 4 * 9) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        if (pixels[i + 3] < 120 || max < 48 || max - min < 20) continue;
        samples.push({ r, g, b, weight: max - min });
      }
      samples.sort((a, b) => b.weight - a.weight);
      const colors = samples.slice(0, 3).map(({ r, g, b }) => `rgb(${r}, ${g}, ${b})`);
      if (colors.length) overlay.style.setProperty("--cover-color-a", colors[0]);
      if (colors.length > 1) overlay.style.setProperty("--cover-color-b", colors[1]);
      if (colors.length > 2) overlay.style.setProperty("--cover-color-c", colors[2]);
      return colors.length > 0;
    } catch {
      return false;
    }
  };
  const sampleLoadedCover = (): void => {
    if (!coverImage?.naturalWidth || !coverImage.naturalHeight) return;
    if (sampleCoverColors(coverImage, coverImage.naturalWidth, coverImage.naturalHeight)) return;
    const fallbackCanvas = document.createElement("canvas");
    fallbackCanvas.width = 24;
    fallbackCanvas.height = 24;
    const fallbackContext = fallbackCanvas.getContext("2d", { willReadFrequently: true });
    if (!fallbackContext) return;
    fallbackContext.fillStyle = "#725b66";
    fallbackContext.fillRect(0, 0, 24, 24);
    fallbackContext.fillStyle = "#47747b";
    fallbackContext.fillRect(0, 0, 12, 24);
    fallbackContext.fillStyle = "#b18c4d";
    fallbackContext.fillRect(12, 0, 12, 24);
    sampleCoverColors(fallbackCanvas, 24, 24);
  };
  if (coverImage?.complete) sampleLoadedCover();
  else coverImage?.addEventListener("load", sampleLoadedCover, { once: true });
  coverImage?.addEventListener("error", () => { overlay.classList.add("cover-colors-unavailable"); }, { once: true });
  let targetX = 50, targetY = 50, currentX = 50, currentY = 50;
  let animationFrame = 0;
  const animateReflection = (): void => {
    if (!overlay.isConnected) { animationFrame = 0; return; }
    currentX += (targetX - currentX) * 0.12;
    currentY += (targetY - currentY) * 0.12;
    zoomCard?.style.setProperty("--cover-light-x", `${currentX}%`);
    zoomCard?.style.setProperty("--cover-light-y", `${currentY}%`);
    if (Math.abs(targetX - currentX) > .1 || Math.abs(targetY - currentY) > .1) animationFrame = requestAnimationFrame(animateReflection);
    else animationFrame = 0;
  };
  const updateReflectionTarget = (): void => {
    if (!animationFrame) animationFrame = requestAnimationFrame(animateReflection);
  };
  overlay.addEventListener("pointermove", (event) => {
    if (!zoomCard || event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = zoomCard.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.top + bounds.width) {
      targetX = 50;
      targetY = 50;
      updateReflectionTarget();
      zoomCard.style.setProperty("--cover-shadow-x", "50%");
      zoomCard.style.setProperty("--cover-shadow-y", "50%");
      zoomCard.style.setProperty("--cover-shadow-opacity", "0");
      zoomCard.style.setProperty("--cover-rotate-x", "0deg");
      zoomCard.style.setProperty("--cover-rotate-y", "0deg");
      return;
    }
    const horizontal = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    const vertical = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    zoomCard.style.setProperty("--cover-rotate-x", `${vertical * -5}deg`);
    zoomCard.style.setProperty("--cover-rotate-y", `${horizontal * 5}deg`);
    targetX = (horizontal + 1) * 50;
    targetY = (vertical + 1) * 50;
    zoomCard.style.setProperty("--cover-shadow-x", `${100 - targetX}%`);
    zoomCard.style.setProperty("--cover-shadow-y", `${100 - targetY}%`);
    zoomCard.style.setProperty("--cover-shadow-opacity", "1");
    updateReflectionTarget();
  });
  overlay.addEventListener("pointerleave", () => {
    targetX = 50;
    targetY = 50;
    updateReflectionTarget();
    zoomCard?.style.setProperty("--cover-shadow-x", "50%");
    zoomCard?.style.setProperty("--cover-shadow-y", "50%");
    zoomCard?.style.setProperty("--cover-shadow-opacity", "0");
    zoomCard?.style.setProperty("--cover-rotate-x", "0deg");
    zoomCard?.style.setProperty("--cover-rotate-y", "0deg");
  });
  app.querySelector(".app-shell")?.append(overlay);
  overlay.querySelector<HTMLElement>(".album-cover-zoom")?.focus();
}

function showAlbumCoverOverlay(): void {
  if (!albumView?.artwork) return;
  showCoverOverlay(albumView.artwork, albumView.name, app.querySelector<HTMLElement>("[data-album-cover-enlarge]"));
}

function ensureLyricsLoaded(): Promise<void> { return lyricsLoader.load(); }

function setNowPlayingWidth(value: number, persist = true): void { panelSizing.setNowPlayingWidth(value, persist); }
function setSidebarCompact(compact: boolean, persist = true): void { panelSizing.setSidebarCompact(compact, persist); }

function bindEvents(centerOnly = false): void {
  if (!centerOnly) {
  if (!artistNavigationBound) {
    app.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !target.matches("[data-personal-setting]")) return;
      const setting = target.dataset.personalSetting;
      if (setting !== "ambientBackground" && setting !== "motionEffects") return;
      updatePersonalizationPreference(setting, target.checked);
      applyPersonalizationPreferences();
    });
    app.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const swatch = target.closest<HTMLButtonElement>("[data-accent-color]");
      if (!swatch) return;
      const preferences = updatePersonalizationPreference("accentColor", swatch.dataset.accentColor ?? "");
      applyPersonalizationPreferences(preferences);
      app.querySelectorAll<HTMLButtonElement>("[data-accent-color]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.accentColor === preferences.accentColor)));
    });
    app.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("[data-cover-overlay-close]")) {
        event.preventDefault();
        closeAlbumCoverOverlay();
        return;
      }
      if (target.closest("[data-album-cover-enlarge]")) {
        event.preventDefault();
        event.stopPropagation();
        showAlbumCoverOverlay();
        return;
      }
      const playlistCover = target.closest<HTMLElement>("[data-playlist-cover-enlarge]");
      if (playlistCover) {
        event.preventDefault();
        event.stopPropagation();
        showCoverOverlay(playlistCover.dataset.coverArtwork ?? "", playlistCover.dataset.coverTitle ?? "플레이리스트", playlistCover);
        return;
      }
      const artistImage = target.closest<HTMLElement>("[data-artist-image-enlarge]");
      if (artistImage) {
        event.preventDefault();
        event.stopPropagation();
        showCoverOverlay(artistImage.dataset.coverArtwork ?? "", artistImage.dataset.coverTitle ?? "아티스트", artistImage);
        return;
      }
      if (target.closest<HTMLElement>("[data-open-album]")) {
        event.preventDefault();
        event.stopPropagation();
        void openCurrentAlbum();
        return;
      }
      const externalLink = target.closest<HTMLAnchorElement>("[data-open-external-url]");
      if (externalLink) {
        event.preventDefault();
        event.stopPropagation();
        const url = externalLink.dataset.openExternalUrl;
        if (url) void openUrl(url).catch(() => showNotice("Spotify 페이지를 열지 못했습니다."));
        return;
      }
      const savedAlbum = target.closest<HTMLElement>("[data-open-saved-album]");
      if (savedAlbum) {
        event.preventDefault();
        event.stopPropagation();
        void openSavedAlbumView(savedAlbum.dataset.openSavedAlbum ?? "");
        return;
      }
      const artistAlbum = target.closest<HTMLElement>("[data-open-artist-album]");
      if (artistAlbum) {
        event.preventDefault();
        event.stopPropagation();
        void openArtistAlbumView(artistAlbum.dataset.openArtistAlbum ?? "");
        return;
      }
      const link = target.closest<HTMLElement>("[data-open-artist]");
      if (!link) return;
      event.preventDefault();
      event.stopPropagation();
      openArtistProfileView(link.dataset.openArtist ?? "", link.dataset.openArtistId ?? "");
    }, true);
    app.addEventListener("keydown", (event) => {
      if (event instanceof KeyboardEvent && event.key === "Escape" && app.querySelector("[data-album-cover-overlay]")) {
        event.preventDefault();
        closeAlbumCoverOverlay();
        return;
      }
      if (!(event instanceof KeyboardEvent) || (event.key !== "Enter" && event.key !== " ")) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("[data-album-cover-enlarge]")) {
        event.preventDefault();
        event.stopPropagation();
        showAlbumCoverOverlay();
        return;
      }
      const playlistCover = target.closest<HTMLElement>("[data-playlist-cover-enlarge]");
      if (playlistCover) {
        event.preventDefault();
        event.stopPropagation();
        showCoverOverlay(playlistCover.dataset.coverArtwork ?? "", playlistCover.dataset.coverTitle ?? "플레이리스트", playlistCover);
        return;
      }
      const artistImage = target.closest<HTMLElement>("[data-artist-image-enlarge]");
      if (artistImage) {
        event.preventDefault();
        event.stopPropagation();
        showCoverOverlay(artistImage.dataset.coverArtwork ?? "", artistImage.dataset.coverTitle ?? "아티스트", artistImage);
        return;
      }
      if (target.closest<HTMLElement>("[data-open-album]")) {
        event.preventDefault();
        event.stopPropagation();
        void openCurrentAlbum();
        return;
      }
      const link = target.closest<HTMLElement>("[data-open-artist]");
      if (!link) return;
      event.preventDefault();
      event.stopPropagation();
      openArtistProfileView(link.dataset.openArtist ?? "", link.dataset.openArtistId ?? "");
    }, true);
    artistNavigationBound = true;
  }
  initCustomTooltips(app);
  panelControls.bind();
  bindGlobalClickDispatcher(app, (target) => {
    if (target.closest("[data-history-back]")) { moveNavigationHistory(-1); return true; }
    if (target.closest("[data-history-forward]")) { moveNavigationHistory(1); return true; }
    if (target.closest("[data-queue]")) {
      if (queueOpen) nowPlayingPanel.showQueue(false);
      else {
        queueTab = "queue";
        nowPlayingPanel.showQueue(true);
      }
      return true;
    }
    return handleNowPlayingClick(target, {
      app,
      lyricsWordSynced: () => Boolean(currentLyrics?.wordSynced),
      toggleLyricsWordMode: () => { lyricsWordMode = !lyricsWordMode; },
      updateLyricsMode: lyricsUi.updateModeView,
      lyricsSynced: () => Boolean(currentLyrics?.synced),
      seekLyrics: (time) => { snapshot = { ...snapshot, position: time }; patchProgress(); void seek(time); },
      lyricsEnabled: () => lyricsPanelEnabled,
      setLyricsEnabled: (enabled) => { lyricsPanelEnabled = enabled; },
      setLyricsEntryPending: (pending) => { lyricsEntryPending = pending; },
      nowPlayingPanelExists: () => Boolean(app.querySelector(".now-playing-panel")),
      openNowPlaying: () => nowPlayingPanel.open(),
      compactSidebar: () => setSidebarCompact(true),
      updateLyricsCard: lyricsUi.updateCard,
      abortLyricsLoad: () => lyricsLoader.abort(),
      ensureLyricsLoaded: () => { void ensureLyricsLoaded(); },
      page: () => page,
      setPage: (value) => { page = value; },
      albumReturnPage: () => albumReturnPage,
      renderMainPage: pageRenderer.renderPage,
      setLastRenderedPage: (value) => { lastRenderedPage = value; syncNavigationHistory(); },
      bindEvents,
      openCurrentAlbum: () => { void openCurrentAlbum(); },
      closeNowPlaying: () => nowPlayingPanel.close(),
      nowPlayingOpen: () => nowPlayingOpen,
      setNowPlayingOpen: (open) => { nowPlayingOpen = open; },
      setQueueTab: (tab) => { queueTab = tab; },
      showQueuePanel: (show) => nowPlayingPanel.showQueue(show),
      render,
      current: () => current,
      showNotice,
      queue: () => playQueue,
      playTrack: (track, queue) => { void playTrack(track, queue); },
    });
  }, (target) => handleSpotifyActionClick(target, {
      app,
      selectedPlaylistId: () => selectedPlaylistId,
      addSearchTrack: (trackId, playlistId) => { void addSearchTrackToPlaylist(trackId, playlistId); },
      targetTrackId: () => topSearchTargetTrack,
      setTargetTrackId: (value) => { topSearchTargetTrack = value; if (value) spotifySearchDropdown.paint(); },
      openPlaylistDialog: () => { playlistDialogOpen = true; playlistDialogBusy = false; playlistDraftName = ""; playlistDraftPublic = false; playlistVisibilityOpen = false; render(); },
      playlistBusy: () => playlistDialogBusy,
      closePlaylistDialog: () => { playlistDialogOpen = false; playlistDialogBusy = false; render(); },
      searchOpen: () => topSearchOpen,
      setSearchOpen: (value) => { topSearchOpen = value; },
      paintSearch: spotifySearchDropdown.paint,
      visibilityOpen: () => playlistVisibilityOpen,
      closeVisibility: () => { playlistVisibilityOpen = false; app.querySelector(".visibility-options")?.remove(); app.querySelector("[data-visibility-toggle]")?.setAttribute("aria-expanded", "false"); },
      sortOpen: () => librarySortOpen,
      closeSort: () => { librarySortOpen = false; app.querySelector(".library-sort-menu")?.remove(); app.querySelector("[data-sort-toggle]")?.setAttribute("aria-expanded", "false"); },
      playSearchResult: (index) => { void playTopSearchResult(index); },
    }));
  }
  const eventRoot = centerOnly ? app.querySelector<HTMLElement>(".main-content") ?? app : app;
  bindLibraryPageEvents({
    app: eventRoot,
    getPage: () => page,
    setPage: (value) => { page = value; },
    closeTopSearch: () => { topSearchOpen = false; },
    setFilter: (value) => { filter = value; },
    setFavoritesOnly: (value) => { favoritesOnly = value; },
    clearPlaylistSelection,
    loadPlaylist: (id, selected, preserveScroll, autoScroll) => { void loadPlaylist(id, selected, preserveScroll, autoScroll); },
    current: () => current,
    render,
    scrollToCurrentTrack,
    setSortMode: (value) => { librarySortMode = value; },
    sortOpen: () => librarySortOpen,
    setSortOpen: (value) => { librarySortOpen = value; },
    visibilityOpen: () => playlistVisibilityOpen,
    setVisibilityOpen: (value) => { playlistVisibilityOpen = value; },
    setPlaylistDraftPublic: (value) => { playlistDraftPublic = value; },
    playlistDraftPublic: () => playlistDraftPublic,
    setPlaylistDraftName: (value) => { playlistDraftName = value; },
    createPlaylist: (name, isPublic) => { void createSpotifyPlaylist(name, isPublic); },
    libraryView: () => libraryView,
    setLibraryView: (value) => { libraryView = value; },
    albumView: () => albumView,
    albumReturnPage: () => albumReturnPage,
    artistReturnPage: () => artistReturnPage,
    activeTracks,
    filter: () => filter,
    selectedPlaylistId: () => selectedPlaylistId,
    selectedPlaylistTracks: () => selectedPlaylistTracks,
    favoritesOnly: () => favoritesOnly,
    tracks: () => tracks,
    favoriteTracks: () => favoriteTracks,
    librarySearchTracks: () => librarySearchTracks,
    recentTracks: () => resolveRecentTracks(recentIds, tracks, recentIds.length),
    sortLibraryTracks,
    mergeTracks,
    showNotice,
    playTrack: (track, queue, context) => { void playTrack(track, queue, context); },
    togglePlay: () => { void togglePlay(); },
    openFavorites: () => {
      page = "library";
      filter = "spotify";
      favoritesOnly = true;
      libraryQuery = "";
      librarySearchTracks = [];
      librarySearchController.cancel();
      clearPlaylistSelection();
      render();
    },
  });
  bindLibrarySourceEvents({
    app: eventRoot,
    addFolder: () => { void addFolder(); },
    addFiles: () => { void addAudioFiles(); },
    connect: () => { void connectSpotify(); },
    disconnect: disconnectSpotifyAccount,
    rescan: (folder) => { void rescan(folder); },
  });
  if (centerOnly) {
    captureNativeTooltips(app);
    markOverflowingAlbumTitles();
    return;
  }
  bindSpotifySearchEvents({
    app,
    query: () => topSearchQuery,
    setQuery: (value) => { topSearchQuery = value; },
    isOpen: () => topSearchOpen,
    setOpen: (value) => { topSearchOpen = value; },
    firstResultAvailable: () => Boolean(topSearchTracks[0]),
    cancelPending: () => spotifySearchController.cancelPending(),
    clearResults: () => { topSearchTracks = []; topSearchLoading = false; },
    paint: spotifySearchDropdown.paint,
    search: (value) => searchTopSpotify(value, 0),
    playFirstResult: () => { void playTopSearchResult(0); },
  });
  metadataRepair.bindEvents(app);
  bindPlaybackEvents({
    app,
    current: () => current,
    firstTrack: () => tracks[0],
    toggleFavorite: (id) => { void toggleFavorite(id); },
    togglePlay: () => { void togglePlay(); },
    playTrack: (track) => { void playTrack(track); },
    addFolder: () => { void addFolder(); },
    nextTrack: () => { void nextTrack(); },
    previousTrack: () => { void previousTrack(); },
    toggleShuffle: () => { void toggleShuffle(); },
    cycleRepeat: () => { void cycleRepeat(); },
    openQueue: () => {
      if (queueOpen) { nowPlayingPanel.showQueue(false); return; }
      queueTab = "queue";
      nowPlayingPanel.showQueue(true);
    },
    render,
    seek: (value) => { void seek(value); },
    setVolume: (value) => { void setVolume(value); },
    toggleMute: () => { void toggleMute(); },
  });
  bindLibrarySearchEvents({
    app,
    setLibraryQuery: (value) => { libraryQuery = value; },
    searchLibrary: (value, caret) => { void searchLibrary(value, caret); },
    setAlbumQuery: (value) => { albumQuery = value; },
    render,
  });
}

function searchTopSpotify(value: string, _caret: number): Promise<void> { return spotifySearchController.search(value); }

function addFolder(): Promise<void> { return localImport.addFolder(); }
function addAudioFiles(): Promise<void> { return localImport.addAudioFiles(); }
function rescan(folder: string): Promise<void> { return localImport.rescan(folder); }

function connectSpotify(switchPage = true): Promise<void> { return spotifyConnection(switchPage); }

async function playTrack(track: Track, queue: Track[] = [track], displayContext?: string): Promise<void> { return trackPlayback(track, queue, displayContext); }

function renderPlaylistDialog(): string {
  return renderPlaylistDialogMarkup({ name: playlistDraftName, isPublic: playlistDraftPublic, visibilityOpen: playlistVisibilityOpen, busy: playlistDialogBusy, icon });
}

function togglePlay(): Promise<void> { return togglePlayback(); }

function resolvePlaybackIntent(reportedPlaying: boolean): boolean {
  const resolved = resolvePlaybackIntentState(playbackIntent, reportedPlaying);
  playbackIntent = resolved.intent;
  return resolved.playing;
}
async function seek(position: number): Promise<void> { return playbackControls.seek(position); }
async function setVolume(volume: number): Promise<void> { return playbackControls.setVolume(volume); }
async function toggleMute(): Promise<void> { return playbackControls.toggleMute(); }
async function nextTrack(): Promise<void> { return playbackControls.nextTrack(); }
async function previousTrack(): Promise<void> { return playbackControls.previousTrack(); }
async function toggleShuffle(): Promise<void> { return playbackControls.toggleShuffle(); }
async function cycleRepeat(): Promise<void> { return playbackControls.cycleRepeat(); }
async function toggleFavorite(id: string): Promise<void> {
  return toggleFavoriteInFeature(id, {
    app, current, tracks, favoriteTracks, librarySearchTracks, topSearchTracks, playQueue, favoriteIds, favoritesOnly,
    favoriteTrackList, mergeTracks,
    setFavoriteIds: (ids) => { favoriteIds = ids; },
    setFavoriteTracks: (items) => { favoriteTracks = items; },
    saveFavorites, saveFavoriteTracks, icon, render,
  });
}
function searchLibrary(value: string, caret: number): Promise<void> { return librarySearchController.search(value, caret); }

function patchProgress(): void { progressController.patchProgress(); }

function patchPlaybackModes(): void {
  const shuffleButton = app.querySelector<HTMLButtonElement>("[data-shuffle]");
  shuffleButton?.classList.toggle("active", snapshot.shuffle);

  const repeatButton = app.querySelector<HTMLButtonElement>("[data-repeat]");
  if (!repeatButton) return;
  const repeating = snapshot.repeat !== "off";
  repeatButton.classList.toggle("active", repeating);
  repeatButton.setAttribute("aria-pressed", String(repeating));
  repeatButton.title = `반복: ${snapshot.repeat === "one" ? "한 곡" : snapshot.repeat === "all" ? "전체" : "끔"}`;
  repeatButton.innerHTML = icon(snapshot.repeat === "one" ? "repeat-one" : "repeat");
}

function persistPlayback(): void {
  persistPlaybackState(restoreState, current, snapshot, playbackPlaylistId);
}

let spotifyAutoAdvanceLock = "";

const startupUpdateCheck = initAppUpdater(() => setIntroStatus("업데이트 확인 중..."));
startAppLifecycle({
  bootLibrary: () => { void startupUpdateCheck.then(() => bootLibrary()); },
  autoConnectSpotify: () => { void autoConnectSpotify(spotifyConnected(), spotifyReady, connectSpotify); },
  dismissIntro,
  nowPlayingOpen: () => nowPlayingOpen,
  windowWidth: () => window.innerWidth,
  sidebarCompact: () => sidebarCompact,
  compactSidebar: () => setSidebarCompact(true),
  shouldSyncLyrics: () => nowPlayingOpen && snapshot.playing && Boolean(currentLyrics?.synced),
  updateSyncedLyrics,
  spotifyConnected,
  startLiveViewer: () => spotifyViewerSync.start(),
  stopLiveViewer: () => spotifyViewerSync.stop(),
  persistPlayback,
  destroyPlayers: () => { localPlayer.destroy(); spotifyPlayer.destroy(); },
});

