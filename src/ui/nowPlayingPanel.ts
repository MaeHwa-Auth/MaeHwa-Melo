interface NowPlayingPanelOptions {
  app: HTMLElement;
  windowWidth: () => number;
  sidebarCompact: () => boolean;
  setSidebarAutoCollapsing: (value: boolean) => void;
  sidebarAutoCollapsing: () => boolean;
  setSidebarCompact: (compact: boolean) => void;
  nowPlayingWidth: () => number;
  maxNowPlayingWidth: () => number;
  setNowPlayingOpen: (open: boolean) => void;
  setNowPlayingOpening: (opening: boolean) => void;
  nowPlayingClosing: () => boolean;
  setNowPlayingClosing: (closing: boolean) => void;
  setQueueOpen: (open: boolean) => void;
  renderPanel: (queue: boolean) => string;
  bindPanelEvents: (panel: HTMLElement) => void;
  bindPanelResizer: (resizer: HTMLElement) => void;
  afterPanelChange: () => void;
}

export function createNowPlayingPanel(options: NowPlayingPanelOptions) {
  function renderResizer(): HTMLElement {
    const resizer = document.createElement("div");
    resizer.className = "now-playing-resizer";
    resizer.dataset.nowPlayingResizer = "";
    resizer.setAttribute("role", "separator");
    resizer.setAttribute("aria-label", "재생 패널 너비 조절");
    resizer.setAttribute("aria-orientation", "vertical");
    resizer.setAttribute("aria-valuemin", "280");
    resizer.setAttribute("aria-valuemax", String(options.maxNowPlayingWidth()));
    resizer.setAttribute("aria-valuenow", String(Math.min(options.nowPlayingWidth(), options.maxNowPlayingWidth())));
    resizer.tabIndex = 0;
    resizer.title = "드래그하거나 방향키로 패널 크기 조절";
    return resizer;
  }

  function updatePanel(queue: boolean): void {
    const workspace = options.app.querySelector<HTMLElement>(".workspace");
    const slot = workspace?.querySelector<HTMLElement>(".now-playing-slot");
    if (!workspace || !slot) return;
    options.setQueueOpen(queue);
    const template = document.createElement("template");
    template.innerHTML = options.renderPanel(queue);
    const nextPanel = template.content.firstElementChild as HTMLElement | null;
    const existingPanel = slot.querySelector<HTMLElement>(".now-playing-panel");
    if (!nextPanel) return;
    if (existingPanel && existingPanel.className !== nextPanel.className) {
      nextPanel.classList.add("is-panel-switching");
      nextPanel.addEventListener("animationend", () => nextPanel.classList.remove("is-panel-switching"), { once: true });
    }
    existingPanel?.replaceWith(nextPanel);
    if (!existingPanel) slot.append(nextPanel);
    options.bindPanelEvents(nextPanel);
    options.afterPanelChange();
  }

  function close(): void {
    if (options.nowPlayingClosing()) return;
    const workspace = options.app.querySelector<HTMLElement>(".workspace.has-now-playing");
    const slot = workspace?.querySelector<HTMLElement>(".now-playing-slot");
    if (!workspace || !slot) {
      options.setNowPlayingOpen(false);
      options.setNowPlayingClosing(false);
      options.afterPanelChange();
      return;
    }
    workspace.style.setProperty("--closing-panel-width", `${slot.getBoundingClientRect().width}px`);
    options.setNowPlayingClosing(true);
    workspace.classList.add("is-closing");
    const panel = slot.querySelector<HTMLElement>(".now-playing-panel");
    if (panel) panel.style.transition = "none";
    window.setTimeout(() => {
      options.setNowPlayingOpen(false);
      options.setNowPlayingClosing(false);
      slot.remove();
      workspace.querySelector(".now-playing-resizer")?.remove();
      workspace.classList.remove("has-now-playing", "is-closing");
      options.afterPanelChange();
    }, 290);
  }

  function open(queue = false): void {
    const workspace = options.app.querySelector<HTMLElement>(".workspace");
    if (!workspace) return;
    if (options.windowWidth() <= 1000 && !options.sidebarCompact()) {
      options.setSidebarAutoCollapsing(true);
      options.setSidebarCompact(true);
      options.app.querySelector(".sidebar")?.classList.add("is-auto-collapsing");
    }
    options.setNowPlayingOpen(true);
    options.setNowPlayingOpening(true);
    options.setQueueOpen(queue);
    workspace.classList.add("has-now-playing", "is-opening");
    const resizer = renderResizer();
    const slot = document.createElement("div");
    slot.className = "now-playing-slot";
    slot.innerHTML = options.renderPanel(queue);
    workspace.append(resizer, slot);
    const panel = slot.querySelector<HTMLElement>(".now-playing-panel");
    if (panel) options.bindPanelEvents(panel);
    options.bindPanelResizer(resizer);
    options.afterPanelChange();
    window.setTimeout(() => {
      workspace.classList.remove("is-opening");
      options.setNowPlayingOpening(false);
    }, 290);
    if (options.sidebarAutoCollapsing()) {
      window.setTimeout(() => {
        options.setSidebarAutoCollapsing(false);
        options.app.querySelector(".sidebar")?.classList.remove("is-auto-collapsing");
      }, 320);
    }
  }

  function showQueue(queue: boolean): void {
    const panel = options.app.querySelector(".workspace .now-playing-slot .now-playing-panel");
    if (!panel) open(queue);
    else updatePanel(queue);
  }

  return { open, close, showQueue };
}
