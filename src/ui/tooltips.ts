let appTooltip: HTMLElement | null = null;
let tooltipEventsBound = false;
let tooltipSuppressed: { key: string; left: number; right: number; top: number; bottom: number } | null = null;
let lastTooltipPointerDownAt = 0;

function tooltipKey(target: HTMLElement): string {
  return target.dataset.playlist
    ? `playlist:${target.dataset.playlist}`
    : `tooltip:${target.dataset.tooltipTitle ?? target.getAttribute("aria-label") ?? target.textContent?.trim() ?? ""}`;
}

function showTooltip(button: HTMLElement): void {
  if (tooltipSuppressed?.key === tooltipKey(button)) return;
  appTooltip?.remove();
  const title = button.dataset.tooltipTitle
    ?? button.querySelector<HTMLElement>(".spotify-sidebar-playlist-art")?.nextElementSibling?.textContent?.trim()
    ?? button.getAttribute("aria-label")
    ?? button.textContent?.trim();
  if (!title) return;

  const tooltip = document.createElement("div");
  tooltip.className = "app-tooltip";
  const titleElement = document.createElement("b");
  titleElement.textContent = title;
  const subtitleElement = document.createElement("span");
  subtitleElement.textContent = button.dataset.tooltipSubtitle
    ?? (button.classList.contains("nav-link") ? "메뉴" : button.classList.contains("spotify-sidebar-playlist") ? "플레이리스트" : "");
  if (!subtitleElement.textContent) subtitleElement.hidden = true;
  tooltip.append(titleElement, subtitleElement);
  document.body.append(tooltip);
  appTooltip = tooltip;

  const anchor = button.getBoundingClientRect();
  const bounds = tooltip.getBoundingClientRect();
  const rightPosition = anchor.right + 9;
  const leftPosition = anchor.left - bounds.width - 9;
  const left = rightPosition + bounds.width <= window.innerWidth - 8
    ? rightPosition
    : leftPosition >= 8
      ? leftPosition
      : Math.max(8, window.innerWidth - bounds.width - 8);
  const top = Math.max(8, Math.min(anchor.top + (anchor.height - bounds.height) / 2, window.innerHeight - bounds.height - 8));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  requestAnimationFrame(() => tooltip.classList.add("visible"));
}

export function hideCustomTooltip(): void {
  appTooltip?.remove();
  appTooltip = null;
}

export function clearTooltipSuppression(): void {
  tooltipSuppressed = null;
}

export function captureNativeTooltips(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[title]").forEach((element) => {
    const title = element.getAttribute("title");
    if (title) element.dataset.tooltipTitle = title;
    element.removeAttribute("title");
  });
}

export function initCustomTooltips(app: HTMLElement): void {
  if (tooltipEventsBound) return;
  tooltipEventsBound = true;
  const tooltipTarget = (target: EventTarget | null): HTMLElement | null => target instanceof HTMLElement
    ? target.closest<HTMLElement>("[data-tooltip-title], .spotify-sidebar-playlist[data-playlist]")
    : null;

  app.addEventListener("pointerdown", () => { lastTooltipPointerDownAt = Date.now(); }, true);
  app.addEventListener("pointerover", (event) => {
    const target = tooltipTarget(event.target);
    if (target && !target.contains(event.relatedTarget as Node | null)) {
      if (tooltipSuppressed?.key === tooltipKey(target)) return;
      tooltipSuppressed = null;
      showTooltip(target);
    }
  });
  app.addEventListener("pointerout", (event) => {
    const target = tooltipTarget(event.target);
    if (target && !target.contains(event.relatedTarget as Node | null)) {
      if (tooltipSuppressed?.key === tooltipKey(target)) tooltipSuppressed = null;
      hideCustomTooltip();
    }
  });
  app.addEventListener("click", (event) => {
    const target = tooltipTarget(event.target);
    if (target) {
      const bounds = target.getBoundingClientRect();
      tooltipSuppressed = { key: tooltipKey(target), left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
      hideCustomTooltip();
    }
  }, true);
  app.addEventListener("pointermove", (event) => {
    if (!tooltipSuppressed) return;
    const { left, right, top, bottom } = tooltipSuppressed;
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) tooltipSuppressed = null;
  }, { passive: true });
  app.addEventListener("pointerleave", () => { tooltipSuppressed = null; });
  app.addEventListener("focusin", (event) => {
    if (Date.now() - lastTooltipPointerDownAt < 500) return;
    const target = tooltipTarget(event.target);
    if (target) showTooltip(target);
  });
  app.addEventListener("focusout", (event) => {
    if (tooltipTarget(event.target)) hideCustomTooltip();
  });
  new MutationObserver((mutations) => mutations.forEach((mutation) => {
    const element = mutation.target as HTMLElement;
    const title = element.getAttribute("title");
    if (title) { element.dataset.tooltipTitle = title; element.removeAttribute("title"); }
  })).observe(app, { subtree: true, attributes: true, attributeFilter: ["title"] });
}
