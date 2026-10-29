type Axis = "x" | "y";

interface ScrollbarControl {
  element: HTMLElement;
  thumb: HTMLDivElement;
  axis: Axis;
}

interface ScrollbarPair {
  vertical?: ScrollbarControl;
  horizontal?: ScrollbarControl;
}

const pairs = new Map<HTMLElement, ScrollbarPair>();
let frame = 0;
let resizeObserver: ResizeObserver | null = null;

function isScrollable(element: HTMLElement, axis: Axis): boolean {
  if (document.getElementById("intro-screen") && !document.getElementById("intro-screen")?.classList.contains("intro-done")) return false;
  if (element.closest(".metadata-repair-backdrop, .metadata-repair-modal, [role='dialog']")) return false;
  const style = getComputedStyle(element);
  const overflow = axis === "y" ? style.overflowY : style.overflowX;
  const extent = axis === "y" ? element.scrollHeight : element.scrollWidth;
  const client = axis === "y" ? element.clientHeight : element.clientWidth;
  return (overflow === "auto" || overflow === "scroll" || overflow === "overlay") && extent > client + 1;
}

function makeControl(host: HTMLElement, axis: Axis): ScrollbarControl {
  const element = document.createElement("div");
  const thumb = document.createElement("div");
  element.className = `custom-scrollbar custom-scrollbar-${axis}`;
  const playlistScrollbar = host.classList.contains("spotify-sidebar-playlists");
  if (playlistScrollbar) element.classList.add("custom-scrollbar-playlists");
  element.setAttribute("aria-hidden", "true");
  thumb.className = `custom-scrollbar-thumb custom-scrollbar-thumb-${axis}`;
  if (playlistScrollbar) thumb.classList.add("custom-scrollbar-playlists");
  const setPlaylistScrollbarVisible = (visible: boolean): void => {
    if (!playlistScrollbar) return;
    element.classList.toggle("is-visible", visible);
    thumb.classList.toggle("is-visible", visible);
  };
  let playlistHideTimer = 0;
  const keepPlaylistScrollbarVisible = (): void => {
    if (!playlistScrollbar) return;
    window.clearTimeout(playlistHideTimer);
    setPlaylistScrollbarVisible(true);
  };
  const schedulePlaylistScrollbarHide = (): void => {
    if (!playlistScrollbar) return;
    window.clearTimeout(playlistHideTimer);
    playlistHideTimer = window.setTimeout(() => setPlaylistScrollbarVisible(false), 260);
  };
  if (playlistScrollbar) {
    host.addEventListener("mouseenter", keepPlaylistScrollbarVisible);
    host.addEventListener("mouseleave", schedulePlaylistScrollbarHide);
    for (const rail of [element, thumb]) {
      rail.addEventListener("mouseenter", keepPlaylistScrollbarVisible);
      rail.addEventListener("mouseleave", schedulePlaylistScrollbarHide);
    }
  }
  document.body.append(element);
  document.body.append(thumb);

  let dragging = false;
  let startPointer = 0;
  let startScroll = 0;

  const pointerPosition = (event: PointerEvent): number => axis === "y" ? event.clientY : event.clientX;
  const scrollPosition = (): number => axis === "y" ? host.scrollTop : host.scrollLeft;
  const setScrollPosition = (value: number): void => {
    if (axis === "y") host.scrollTop = value;
    else host.scrollLeft = value;
  };
  const maxScroll = (): number => axis === "y" ? host.scrollHeight - host.clientHeight : host.scrollWidth - host.clientWidth;
  const thumbLength = (): number => axis === "y" ? thumb.getBoundingClientRect().height : thumb.getBoundingClientRect().width;
  const trackLength = (): number => axis === "y" ? element.getBoundingClientRect().height : element.getBoundingClientRect().width;

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    const point = pointerPosition(event);
    if (event.target === thumb) {
      dragging = true;
      startPointer = point;
      startScroll = scrollPosition();
      thumb.classList.add("is-dragging");
      thumb.setPointerCapture(event.pointerId);
    } else {
      const rect = element.getBoundingClientRect();
      const origin = axis === "y" ? rect.top : rect.left;
      const travel = Math.max(1, trackLength() - thumbLength() - 2);
      const offset = Math.max(0, Math.min(travel, point - origin - 1 - thumbLength() / 2));
      setScrollPosition(maxScroll() * offset / travel);
    }
  };
  element.addEventListener("pointerdown", onPointerDown);
  thumb.addEventListener("pointerdown", onPointerDown);
  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging) return;
    const travel = Math.max(1, trackLength() - thumbLength() - 2);
    const delta = pointerPosition(event) - startPointer;
    setScrollPosition(startScroll + delta * maxScroll() / travel);
  };
  element.addEventListener("pointermove", onPointerMove);
  thumb.addEventListener("pointermove", onPointerMove);
  const stopDragging = (): void => {
    dragging = false;
    thumb.classList.remove("is-dragging");
  };
  for (const target of [element, thumb]) {
    target.addEventListener("pointerup", stopDragging);
    target.addEventListener("pointercancel", stopDragging);
    target.addEventListener("lostpointercapture", stopDragging);
  }

  return { element, thumb, axis };
}

function visibleRect(host: HTMLElement): DOMRect | null {
  const rect = host.getBoundingClientRect();
  let top = Math.max(0, rect.top);
  let right = Math.min(window.innerWidth, rect.right);
  let bottom = Math.min(window.innerHeight, rect.bottom);
  let left = Math.max(0, rect.left);
  for (let parent = host.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const bounds = parent.getBoundingClientRect();
    if (style.overflowY !== "visible") { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
    if (style.overflowX !== "visible") { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
  }
  return right > left && bottom > top ? new DOMRect(left, top, right - left, bottom - top) : null;
}

function updateControl(host: HTMLElement, control?: ScrollbarControl): void {
  if (!control) return;
  const rect = visibleRect(host);
  if (!rect) { control.element.style.display = "none"; control.thumb.style.display = "none"; return; }
  control.element.style.display = "block";
  control.thumb.style.display = "block";

  const vertical = control.axis === "y";
  const workspace = host.closest<HTMLElement>(".workspace");
  const adjacentPanel = vertical && host.classList.contains("main-content") && workspace?.classList.contains("has-now-playing") && window.innerWidth > 620;
  const client = vertical ? host.clientHeight : host.clientWidth;
  const extent = vertical ? host.scrollHeight : host.scrollWidth;
  const position = vertical ? host.scrollTop : host.scrollLeft;
  const total = vertical ? rect.height - 6 : rect.width - 6;
  const length = Math.min(Math.max(0, total - 2), Math.max(24, total * client / extent));
  const travel = Math.max(0, total - length - 2);
  const offset = extent > client ? position / (extent - client) * travel : 0;
  control.element.classList.toggle("custom-scrollbar-panel-edge", Boolean(adjacentPanel));
  control.thumb.classList.toggle("custom-scrollbar-panel-edge", Boolean(adjacentPanel));
  if (vertical) {
    const panelLeft = adjacentPanel ? workspace!.querySelector<HTMLElement>(".now-playing-panel")?.getBoundingClientRect().left : undefined;
    const playlistRail = host.classList.contains("spotify-sidebar-playlists");
    const compactSidebar = playlistRail && host.closest(".sidebar")?.classList.contains("is-compact");
    const railWidth = playlistRail ? 4 : adjacentPanel ? 6 : 8;
    // Keep the Spotify playlist rail on the sidebar's inner left edge. Other
    // vertical rails stay aligned to the right edge of their scroll hosts.
    const railLeft = playlistRail
      ? Math.max(0, rect.left - (compactSidebar ? 5 : 6))
      : (panelLeft !== undefined ? Math.min(rect.right, panelLeft) : rect.right) - railWidth;
    control.element.style.left = `${railLeft}px`;
    control.element.style.top = `${rect.top + 3}px`;
    control.element.style.width = `${railWidth}px`;
    control.element.style.height = `${Math.max(0, rect.height - 6)}px`;
    control.thumb.style.left = `${railLeft + (adjacentPanel ? 1 : 1)}px`;
    control.thumb.style.top = `${rect.top + 4}px`;
    control.thumb.style.width = `${playlistRail ? 3 : adjacentPanel ? 4 : 6}px`;
    control.thumb.style.height = `${length}px`;
    control.thumb.style.transform = `translateY(${offset}px)`;
  } else {
    control.element.style.left = `${rect.left + 3}px`;
    control.element.style.top = `${rect.bottom - 8}px`;
    control.element.style.width = `${Math.max(0, rect.width - 6)}px`;
    control.element.style.height = "8px";
    control.thumb.style.left = `${rect.left + 4}px`;
    control.thumb.style.top = `${rect.bottom - 7}px`;
    control.thumb.style.height = "6px";
    control.thumb.style.width = `${length}px`;
    control.thumb.style.transform = `translateX(${offset}px)`;
  }
}

function updatePair(host: HTMLElement, pair: ScrollbarPair): void {
  updateControl(host, pair.vertical);
  updateControl(host, pair.horizontal);
}

function discover(root: HTMLElement): void {
  const found = new Set<HTMLElement>();
  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    if (isScrollable(element, "x") || isScrollable(element, "y")) found.add(element);
  });
  if (isScrollable(root, "x") || isScrollable(root, "y")) found.add(root);

  for (const [host, pair] of pairs) {
    if (found.has(host) && host.isConnected) continue;
    pair.vertical?.element.remove(); pair.vertical?.thumb.remove();
    pair.horizontal?.element.remove(); pair.horizontal?.thumb.remove();
    resizeObserver?.unobserve(host);
    pairs.delete(host);
  }

  for (const host of found) {
    let pair = pairs.get(host);
    if (!pair) {
      pair = {};
      pairs.set(host, pair);
      resizeObserver?.observe(host);
      for (const child of host.children) if (child instanceof HTMLElement) resizeObserver?.observe(child);
    }
    if (isScrollable(host, "y") && !pair.vertical) pair.vertical = makeControl(host, "y");
    if (isScrollable(host, "x") && !pair.horizontal) pair.horizontal = makeControl(host, "x");
    if (!isScrollable(host, "y") && pair.vertical) { pair.vertical.element.remove(); pair.vertical.thumb.remove(); delete pair.vertical; }
    if (!isScrollable(host, "x") && pair.horizontal) { pair.horizontal.element.remove(); pair.horizontal.thumb.remove(); delete pair.horizontal; }
    host.classList.toggle("has-custom-scrollbar-x", Boolean(pair.horizontal));
    updatePair(host, pair);
  }
}

function scheduleUpdate(): void {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    for (const [host, pair] of pairs) updatePair(host, pair);
  });
}

export function refreshCustomScrollbars(root: HTMLElement): void {
  discover(root);
  scheduleUpdate();
}

export function initCustomScrollbars(root: HTMLElement): void {
  resizeObserver = new ResizeObserver(scheduleUpdate);
  resizeObserver.observe(root);
  new MutationObserver(() => {
    discover(root);
    scheduleUpdate();
  }).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
  window.addEventListener("resize", scheduleUpdate, { passive: true });
  document.addEventListener("scroll", scheduleUpdate, { passive: true, capture: true });
  discover(root);
}
