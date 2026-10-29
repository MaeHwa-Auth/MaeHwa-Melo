interface LyricsUiOptions {
  app: HTMLElement;
  renderLyrics: () => string;
  enabled: () => boolean;
  takeEntryPending: () => boolean;
  resetSync: () => void;
  updateSyncedLyrics: () => void;
}

const lyricsScrollListenersBound = new WeakSet<HTMLElement>();

export function bindLyricsScrollIntent(app: HTMLElement, markManualScroll: (until: number) => void): void {
  if (lyricsScrollListenersBound.has(app)) return;
  lyricsScrollListenersBound.add(app);
  const mark = () => markManualScroll(Date.now() + 4200);
  app.addEventListener("wheel", (event) => {
    if ((event.target as HTMLElement).closest("[data-lyrics-scroll]")) mark();
  }, { passive: true });
  app.addEventListener("touchstart", (event) => {
    if ((event.target as HTMLElement).closest("[data-lyrics-scroll]")) mark();
  }, { passive: true });
  app.addEventListener("pointerdown", (event) => {
    const container = (event.target as HTMLElement).closest<HTMLElement>("[data-lyrics-scroll]");
    if (container && event.clientX >= container.getBoundingClientRect().right - 12) mark();
  }, { passive: true });
}

export function createLyricsUi(options: LyricsUiOptions) {
  function animateCardIn(card: HTMLElement | null): void {
    if (!card || !options.takeEntryPending()) return;
    const style = getComputedStyle(card);
    const height = card.getBoundingClientRect().height || 0;
    const animatedProperties = ["overflow", "opacity", "height", "padding-top", "padding-bottom", "margin-bottom", "transform", "visibility"];
    const previousInlineStyles = new Map(animatedProperties.map((property) => [property, card.style.getPropertyValue(property)]));
    const finalState = {
      opacity: 1,
      height: `${height}px`,
      paddingTop: style.paddingTop,
      paddingBottom: style.paddingBottom,
      marginBottom: style.marginBottom,
      transform: "translateY(0)",
    };
    card.style.overflow = "hidden";
    card.style.opacity = "0";
    card.style.height = "0px";
    card.style.paddingTop = "0px";
    card.style.paddingBottom = "0px";
    card.style.marginBottom = "0px";
    card.style.transform = "translateY(-5px)";
    card.style.visibility = "hidden";
    requestAnimationFrame(() => {
      if (!card.isConnected) return;
      card.style.visibility = "visible";
      const animation = card.animate(
        [
          { opacity: 0, height: "0px", paddingTop: "0px", paddingBottom: "0px", marginBottom: "0px", transform: "translateY(-5px)" },
          finalState,
        ],
        { duration: 360, easing: "cubic-bezier(.64,0,.78,0)", fill: "both" },
      );
      void animation.finished.then(() => {
        for (const [property, value] of previousInlineStyles) {
          if (value) card.style.setProperty(property, value);
          else card.style.removeProperty(property);
        }
        animation.cancel();
      }).catch(() => undefined);
    });
  }

  function updateModeView(): void {
    const container = options.app.querySelector<HTMLElement>("[data-lyrics-scroll]");
    const card = options.app.querySelector<HTMLElement>(".now-playing-lyrics");
    if (!container || !card) return;
    const scrollTop = container.scrollTop;
    const template = document.createElement("template");
    template.innerHTML = options.renderLyrics();
    const updatedCard = template.content.firstElementChild as HTMLElement | null;
    const updatedScroll = updatedCard?.querySelector<HTMLElement>("[data-lyrics-scroll]");
    if (!updatedCard) return;
    if (updatedScroll) updatedScroll.scrollTop = scrollTop;
    card.replaceWith(updatedCard);
    options.resetSync();
    options.updateSyncedLyrics();
  }

  function updateCard(): void {
    const panel = options.app.querySelector<HTMLElement>(".now-playing-panel");
    if (!panel) return;
    const existing = panel.querySelector<HTMLElement>(".now-playing-lyrics");
    if (!options.enabled()) {
      if (existing) {
        const height = existing.getBoundingClientRect().height;
        const style = getComputedStyle(existing);
        const animation = existing.animate([
          { opacity: 1, height: `${height}px`, paddingTop: style.paddingTop, paddingBottom: style.paddingBottom, marginBottom: style.marginBottom, transform: "translateY(0)" },
          { opacity: 0, height: "0px", paddingTop: "0px", paddingBottom: "0px", marginBottom: "0px", transform: "translateY(-5px)" },
        ], { duration: 360, easing: "cubic-bezier(.64,0,.78,0)" });
        existing.style.overflow = "hidden";
        void animation.finished.then(() => existing.remove()).catch(() => undefined);
      }
      return;
    }
    const template = document.createElement("template");
    template.innerHTML = options.renderLyrics();
    const updatedCard = template.content.firstElementChild as HTMLElement | null;
    if (!updatedCard) return;
    if (!existing) {
      const anchor = panel.querySelector(".now-playing-credits, .now-playing-up-next");
      if (anchor) {
        panel.insertBefore(updatedCard, anchor);
        options.resetSync();
        animateCardIn(updatedCard);
      }
    } else {
      existing.replaceWith(updatedCard);
      animateCardIn(panel.querySelector<HTMLElement>(".now-playing-lyrics"));
      options.resetSync();
    }
    options.updateSyncedLyrics();
  }

  return { animateCardIn, updateModeView, updateCard };
}
