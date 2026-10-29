interface RenderLifecycleOptions {
  app: HTMLElement;
  hideTooltip: () => void;
  pageKey: () => string;
  lastRenderedPage: () => string | undefined;
  setLastRenderedPage: (page: string) => void;
  nowPlayingOpen: () => boolean;
  queuePanelOpen: () => boolean;
  nowPlayingClosing: () => boolean;
  renderNowPlayingPanel: () => string;
  renderQueueDrawer: () => string;
  bindPanelEvents: (panel: HTMLElement) => void;
  captureTooltips: (root: HTMLElement) => void;
  markOverflowingTitles: () => void;
  lyricsEnabled: () => boolean;
  lyricsEntryPending: () => boolean;
  animateLyricsCardIn: (card: HTMLElement | null) => void;
  observeResponsiveLayout: () => void;
  isOpening: () => boolean;
  setNowPlayingOpening: (opening: boolean) => void;
  bindEvents: () => void;
  refreshArtwork: () => void;
  patchProgress: () => void;
  ensureLyricsLoaded: () => void;
}

export function createRenderLifecycle(options: RenderLifecycleOptions) {
  function begin(): { scrollTop: number; existingNowPlayingSlot: HTMLElement | null } {
    options.hideTooltip();
    const previousMain = options.app.querySelector<HTMLElement>(".main-content");
    const scrollTop = previousMain && options.lastRenderedPage() === options.pageKey() ? previousMain.scrollTop : 0;
    const existingNowPlayingSlot = options.nowPlayingOpen() ? options.app.querySelector<HTMLElement>(".now-playing-slot") : null;
    return { scrollTop, existingNowPlayingSlot };
  }

  function finish(scrollTop: number, existingNowPlayingSlot: HTMLElement | null): void {
    const placeholder = options.app.querySelector<HTMLElement>("#now-playing-slot-placeholder");
    if (placeholder && existingNowPlayingSlot) {
      placeholder.replaceWith(existingNowPlayingSlot);
    } else if (placeholder && options.nowPlayingOpen()) {
      const newSlot = document.createElement("div");
      newSlot.className = `now-playing-slot ${options.nowPlayingClosing() ? "is-closing" : ""}`;
      newSlot.setAttribute("aria-hidden", String(options.nowPlayingClosing()));
      newSlot.innerHTML = options.queuePanelOpen() ? options.renderQueueDrawer() : options.renderNowPlayingPanel();
      placeholder.replaceWith(newSlot);
    }
    const nowPlayingSlot = options.app.querySelector<HTMLElement>(".now-playing-slot");
    const existingPanel = nowPlayingSlot?.querySelector<HTMLElement>(".now-playing-panel");
    const panelMarkup = options.queuePanelOpen() ? options.renderQueueDrawer() : options.renderNowPlayingPanel();
    if (nowPlayingSlot && panelMarkup) {
      const template = document.createElement("template");
      template.innerHTML = panelMarkup;
      const nextPanel = template.content.firstElementChild;
      if (nextPanel) {
        if (existingPanel && existingPanel.className === nextPanel.className) {
          const scrollableContent = existingPanel.querySelector<HTMLElement>(".queue-content, .now-playing-panel");
          const scrollTop = scrollableContent?.scrollTop ?? existingPanel.scrollTop;
          const activeControl = document.activeElement instanceof HTMLElement && existingPanel.contains(document.activeElement)
            ? document.activeElement
            : null;
          const activeQueueTab = activeControl?.dataset.queueTab;
          const activeQueuePlay = activeControl?.dataset.queuePlay;
          const activeQueueKind = activeControl?.dataset.queueKind;
          existingPanel.replaceChildren(...Array.from(nextPanel.childNodes));
          const nextScrollableContent = existingPanel.querySelector<HTMLElement>(".queue-content, .now-playing-panel");
          if (nextScrollableContent) nextScrollableContent.scrollTop = scrollTop;
          else existingPanel.scrollTop = scrollTop;
          const nextActiveControl = Array.from(existingPanel.querySelectorAll<HTMLElement>("[data-queue-tab], [data-queue-play]"))
            .find((element) => activeQueueTab !== undefined
              ? element.dataset.queueTab === activeQueueTab
              : activeQueuePlay !== undefined
                ? element.dataset.queuePlay === activeQueuePlay && element.dataset.queueKind === activeQueueKind
                : false);
          nextActiveControl?.focus({ preventScroll: true });
        } else if (existingPanel) {
          nextPanel.classList.add("is-panel-switching");
          nextPanel.addEventListener("animationend", () => nextPanel.classList.remove("is-panel-switching"), { once: true });
          existingPanel.replaceWith(nextPanel);
        }
        else nowPlayingSlot.append(nextPanel);
      }
    } else existingPanel?.remove();
    const activePanel = nowPlayingSlot?.querySelector<HTMLElement>(".now-playing-panel");
    if (activePanel) options.bindPanelEvents(activePanel);
    options.captureTooltips(options.app);
    options.markOverflowingTitles();
    if (options.lyricsEnabled() && options.lyricsEntryPending()) {
      options.animateLyricsCardIn(options.app.querySelector<HTMLElement>(".now-playing-lyrics"));
    }
    const mainContent = options.app.querySelector<HTMLElement>(".main-content");
    if (mainContent) mainContent.scrollTop = scrollTop;
    options.observeResponsiveLayout();
    const openingWorkspace = options.app.querySelector<HTMLElement>(".workspace.is-opening");
    if (openingWorkspace) {
      window.setTimeout(() => {
        openingWorkspace.classList.remove("is-opening");
        options.setNowPlayingOpening(false);
      }, 290);
    }
    options.setLastRenderedPage(options.pageKey());
    options.bindEvents();
    options.refreshArtwork();
    options.patchProgress();
    options.ensureLyricsLoaded();
  }

  return { begin, finish };
}
