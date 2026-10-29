let trackColumnsObserver: ResizeObserver | null = null;
let nowPlayingTypographyObserver: ResizeObserver | null = null;

export function maxNowPlayingWidth(): number {
  if (window.innerWidth > 1000) return Math.min(520, Math.max(280, Math.floor(window.innerWidth * 0.38)));
  const sidebarWidth = window.innerWidth <= 850 ? 175 : 205;
  return Math.min(520, Math.max(280, Math.floor((window.innerWidth - sidebarWidth) / 2)));
}

export function expandedSidebarWidth(): number {
  return window.innerWidth <= 850 ? 226 : 246;
}

function applyResponsiveLayout(app: ParentNode, onOverflowCheck: () => void): void {
  const mainContent = app.querySelector<HTMLElement>(".main-content");
  if (mainContent) {
    const width = mainContent.getBoundingClientRect().width;
    mainContent.classList.toggle("toolbar-compact", width <= 520);
    mainContent.classList.toggle("columns-hide-heart", width <= 520);
    mainContent.classList.toggle("columns-hide-source", width <= 520);
    mainContent.classList.toggle("columns-hide-duration", width <= 290);
    mainContent.classList.toggle("columns-hide-album", width <= 400);
    window.requestAnimationFrame(onOverflowCheck);
  }

}

export function refreshResponsiveLayoutState(app: ParentNode, onOverflowCheck: () => void): void {
  applyResponsiveLayout(app, onOverflowCheck);
}

export function pauseResponsiveObservers(): void {
  trackColumnsObserver?.disconnect();
  nowPlayingTypographyObserver?.disconnect();
}

export function observeResponsiveLayout(app: ParentNode, isResizing: () => boolean, onOverflowCheck: () => void): void {
  pauseResponsiveObservers();
  const refresh = () => {
    if (!isResizing()) applyResponsiveLayout(app, onOverflowCheck);
  };

  const mainContent = app.querySelector<HTMLElement>(".main-content");
  if (mainContent) {
    trackColumnsObserver = new ResizeObserver(refresh);
    trackColumnsObserver.observe(mainContent);
  }

  const nowPlayingPanel = app.querySelector<HTMLElement>(".now-playing-panel");
  if (nowPlayingPanel) {
    nowPlayingTypographyObserver = new ResizeObserver(refresh);
    nowPlayingTypographyObserver.observe(nowPlayingPanel);
  }
}
