interface PanelSizingOptions {
  app: HTMLElement;
  nowPlayingOpen: () => boolean;
  closeNowPlaying: () => void;
  windowWidth: () => number;
  setSidebarCompactState: (compact: boolean) => void;
  setNowPlayingWidthState: (width: number) => void;
  maxNowPlayingWidth: () => number;
  expandedSidebarWidth: () => number;
}

export function createPanelSizing(options: PanelSizingOptions) {
  function setNowPlayingWidth(value: number, persist = true): void {
    const width = Math.max(280, Math.min(options.maxNowPlayingWidth(), value));
    options.setNowPlayingWidthState(width);
    options.app.querySelector<HTMLElement>(".workspace.has-now-playing")?.style.setProperty("--now-playing-width", `${width}px`);
    options.app.querySelector<HTMLElement>("[data-now-playing-resizer]")?.setAttribute("aria-valuenow", String(width));
    if (persist) { try { localStorage.setItem("maehwa.now-playing-width.v1", String(width)); } catch { /* Keep resizing available if storage is unavailable. */ } }
  }

  function setSidebarCompact(compact: boolean, persist = true): void {
    if (!compact && options.nowPlayingOpen() && options.windowWidth() <= 1000) options.closeNowPlaying();
    options.setSidebarCompactState(compact);
    const sidebar = options.app.querySelector<HTMLElement>(".sidebar");
    sidebar?.classList.toggle("is-compact", compact);
    const width = compact ? 92 : options.expandedSidebarWidth();
    sidebar?.style.setProperty("--sidebar-width", `${width}px`);
    sidebar?.style.setProperty("width", `${width}px`);
    sidebar?.style.setProperty("flex-basis", `${width}px`);
    const resizer = options.app.querySelector<HTMLElement>("[data-sidebar-resizer]");
    resizer?.setAttribute("aria-valuemax", String(options.expandedSidebarWidth()));
    resizer?.setAttribute("aria-valuenow", String(compact ? 92 : options.expandedSidebarWidth()));
    resizer?.setAttribute("aria-valuetext", compact ? "축소" : "전체");
    if (persist) { try { localStorage.setItem("maehwa.sidebar-compact.v1", String(compact)); } catch { /* Keep sidebar resizing available if storage is unavailable. */ } }
  }

  return { setNowPlayingWidth, setSidebarCompact };
}
