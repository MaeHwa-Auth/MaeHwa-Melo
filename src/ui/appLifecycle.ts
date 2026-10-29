interface AppLifecycleOptions {
  bootLibrary: () => void;
  autoConnectSpotify: () => void;
  dismissIntro: () => void;
  nowPlayingOpen: () => boolean;
  windowWidth: () => number;
  sidebarCompact: () => boolean;
  compactSidebar: () => void;
  shouldSyncLyrics: () => boolean;
  updateSyncedLyrics: () => void;
  spotifyConnected: () => boolean;
  startLiveViewer: () => void;
  stopLiveViewer: () => void;
  persistPlayback: () => void;
  destroyPlayers: () => void;
}

export function startAppLifecycle(options: AppLifecycleOptions): void {
  options.bootLibrary();
  options.autoConnectSpotify();
  // Intro fallback: dismiss it after five seconds if initialization is delayed.
  window.setTimeout(options.dismissIntro, 5000);
  window.addEventListener("resize", () => {
    if (options.nowPlayingOpen() && options.windowWidth() <= 1000 && !options.sidebarCompact()) options.compactSidebar();
  });
  window.setInterval(() => {
    if (options.shouldSyncLyrics()) options.updateSyncedLyrics();
  }, 120);
  // Start live viewer only when Spotify is connected AND the now-playing panel is open.
  if (options.spotifyConnected() && options.nowPlayingOpen()) {
    options.startLiveViewer();
  } else if (!options.spotifyConnected()) {
    console.log("[live-viewer] Spotify token not found; waiting for login");
  } else {
    console.log("[live-viewer] Spotify connected but now-playing is closed; live viewer will start when opened.");
  }
  window.addEventListener("beforeunload", () => {
    options.persistPlayback();
    options.stopLiveViewer();
    options.destroyPlayers();
  });
}
