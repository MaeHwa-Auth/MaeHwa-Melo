import { getCurrentWindow } from "@tauri-apps/api/window";
import { maxNowPlayingWidth, observeResponsiveLayout, pauseResponsiveObservers, refreshResponsiveLayoutState } from "./panelLayout";
import { clearTooltipSuppression, hideCustomTooltip } from "./tooltips";

interface WindowAndPanelControlsOptions {
  app: HTMLElement;
  isTauriRuntime: () => boolean;
  isSidebarCompact: () => boolean;
  setSidebarCompact: (compact: boolean, persist?: boolean) => void;
  getNowPlayingWidth: () => number;
  setNowPlayingWidth: (width: number, persist?: boolean) => void;
  markOverflowingTitles: () => void;
}

export function createWindowAndPanelControls(options: WindowAndPanelControlsOptions) {
  let sidebarCleanupTimer: number | null = null;
  let panelResizeFrame: number | null = null;
  let resizingPanel = false;

  function bindPanelResizer(panelResizer = options.app.querySelector<HTMLElement>("[data-now-playing-resizer]")): void {
    if (!panelResizer || panelResizer.dataset.bound === "true") return;
    panelResizer.dataset.bound = "true";
    panelResizer.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      hideCustomTooltip();
      clearTooltipSuppression();
      resizingPanel = true;
      pauseResponsiveObservers();
      panelResizer.closest(".workspace")?.classList.add("is-resizing");
      const workspace = options.app.querySelector<HTMLElement>(".workspace.has-now-playing");
      workspace?.style.setProperty("will-change", "--now-playing-width");
      const startX = event.clientX;
      const startWidth = panelResizer.nextElementSibling?.getBoundingClientRect().width ?? Math.min(options.getNowPlayingWidth(), maxNowPlayingWidth());
      const resizer = panelResizer;
      panelResizer.setPointerCapture(event.pointerId);
      const onMove = (moveEvent: PointerEvent) => {
        if (panelResizeFrame !== null) return;
        panelResizeFrame = window.requestAnimationFrame(() => {
          const newWidth = startWidth + startX - moveEvent.clientX;
          options.setNowPlayingWidth(Math.max(280, Math.min(maxNowPlayingWidth(), newWidth)), false);
          panelResizeFrame = null;
        });
      };
      const onEnd = () => {
        resizingPanel = false;
        panelResizer.closest(".workspace")?.classList.remove("is-resizing");
        workspace?.style.removeProperty("will-change");
        panelResizer.removeEventListener("pointermove", onMove);
        panelResizer.removeEventListener("pointerup", onEnd);
        panelResizer.removeEventListener("pointercancel", onEnd);
        try { localStorage.setItem("maehwa.now-playing-width.v1", String(options.getNowPlayingWidth())); } catch { /* Keep resizing available if storage is unavailable. */ }
        window.requestAnimationFrame(() => {
          refreshResponsiveLayoutState(options.app, options.markOverflowingTitles);
          observeResponsiveLayout(options.app, () => resizingPanel, options.markOverflowingTitles);
        });
      };
      panelResizer.addEventListener("pointermove", onMove, { passive: true });
      panelResizer.addEventListener("pointerup", onEnd);
      panelResizer.addEventListener("pointercancel", onEnd);
    });
    panelResizer.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); options.setNowPlayingWidth(options.getNowPlayingWidth() + 20); }
      else if (event.key === "ArrowRight") { event.preventDefault(); options.setNowPlayingWidth(options.getNowPlayingWidth() - 20); }
      else if (event.key === "Home") { event.preventDefault(); options.setNowPlayingWidth(280); }
      else if (event.key === "End") { event.preventDefault(); options.setNowPlayingWidth(520); }
    });
  }

  function bind(): void {
    const windowApi = getCurrentWindow();
    options.app.querySelector<HTMLElement>(".topbar")?.addEventListener("mousedown", (event) => {
      if (!options.isTauriRuntime() || event.button !== 0 || (event.target as HTMLElement).closest("button, a, input, label")) return;
      void windowApi.startDragging();
    });
    options.app.querySelector<HTMLElement>(".topbar")?.addEventListener("dblclick", (event) => {
      if (!options.isTauriRuntime() || (event.target as HTMLElement).closest("button, a")) return;
      void windowApi.toggleMaximize();
    });
    options.app.querySelector<HTMLButtonElement>("[data-window-minimize]")?.addEventListener("click", () => { if (options.isTauriRuntime()) void windowApi.minimize(); });
    options.app.querySelector<HTMLButtonElement>("[data-window-maximize]")?.addEventListener("click", () => { if (options.isTauriRuntime()) void windowApi.toggleMaximize(); });
    options.app.querySelector<HTMLButtonElement>("[data-window-close]")?.addEventListener("click", () => { if (options.isTauriRuntime()) void windowApi.close(); });

    const sidebarResizer = options.app.querySelector<HTMLElement>("[data-sidebar-resizer]");
    sidebarResizer?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (sidebarCleanupTimer !== null) { window.clearTimeout(sidebarCleanupTimer); sidebarCleanupTimer = null; }
      hideCustomTooltip();
      clearTooltipSuppression();
      const workspace = sidebarResizer.closest(".workspace");
      workspace?.classList.add("is-resizing-sidebar");
      const startX = event.clientX;
      let changed = false;
      let ended = false;
      sidebarResizer.setPointerCapture(event.pointerId);
      const onMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX;
        if (delta <= -24 && !options.isSidebarCompact()) {
          changed = true;
          options.setSidebarCompact(true, false);
        } else if (delta >= 24 && options.isSidebarCompact()) {
          changed = true;
          options.setSidebarCompact(false, false);
        }
      };
      const onEnd = () => {
        if (ended) return;
        ended = true;
        if (changed) {
          sidebarCleanupTimer = window.setTimeout(() => {
            workspace?.classList.remove("is-resizing-sidebar");
            sidebarCleanupTimer = null;
          }, 300);
        } else workspace?.classList.remove("is-resizing-sidebar");
        sidebarResizer.removeEventListener("pointermove", onMove);
        sidebarResizer.removeEventListener("pointerup", onEnd);
        sidebarResizer.removeEventListener("pointercancel", onEnd);
        sidebarResizer.removeEventListener("lostpointercapture", onEnd);
        if (sidebarResizer.hasPointerCapture(event.pointerId)) sidebarResizer.releasePointerCapture(event.pointerId);
        if (changed) { try { localStorage.setItem("maehwa.sidebar-compact.v1", String(options.isSidebarCompact())); } catch { /* Keep resizing available if storage is unavailable. */ } }
      };
      sidebarResizer.addEventListener("pointermove", onMove);
      sidebarResizer.addEventListener("pointerup", onEnd);
      sidebarResizer.addEventListener("pointercancel", onEnd);
      sidebarResizer.addEventListener("lostpointercapture", onEnd);
    });
    sidebarResizer?.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft" || event.key === "Home") { event.preventDefault(); options.setSidebarCompact(true); }
      else if (event.key === "ArrowRight" || event.key === "End") { event.preventDefault(); options.setSidebarCompact(false); }
      else if (event.key === " ") { event.preventDefault(); options.setSidebarCompact(!options.isSidebarCompact()); }
    });

    bindPanelResizer();
  }

  return { bind, bindPanelResizer, isResizingPanel: () => resizingPanel };
}
