interface SpotifySearchEventsOptions {
  app: HTMLElement;
  query: () => string;
  setQuery: (query: string) => void;
  isOpen: () => boolean;
  setOpen: (open: boolean) => void;
  firstResultAvailable: () => boolean;
  cancelPending: () => void;
  clearResults: () => void;
  paint: () => void;
  search: (query: string) => Promise<void>;
  playFirstResult: () => void;
}

export function bindSpotifySearchEvents(options: SpotifySearchEventsOptions): void {
  const input = options.app.querySelector<HTMLInputElement>("#top-search-input");
  input?.addEventListener("focus", () => {
    if (!options.isOpen()) { options.setOpen(true); options.paint(); }
  });
  input?.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement;
    options.setQuery(target.value);
    options.setOpen(true);
    if ((event as InputEvent).isComposing) {
      options.cancelPending();
      options.clearResults();
      options.paint();
      return;
    }
    void options.search(target.value);
  });
  input?.addEventListener("compositionend", (event) => {
    const target = event.target as HTMLInputElement;
    options.setQuery(target.value);
    options.setOpen(true);
    void options.search(target.value);
  });
  input?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { options.setOpen(false); options.paint(); }
    if (event.key === "Enter" && options.firstResultAvailable()) { event.preventDefault(); options.playFirstResult(); }
  });
  options.app.querySelector<HTMLElement>("[data-search-clear]")?.addEventListener("click", () => {
    options.setQuery("");
    options.setOpen(true);
    const searchInput = options.app.querySelector<HTMLInputElement>("#top-search-input");
    if (searchInput) { searchInput.value = ""; searchInput.focus(); }
    void options.search("");
  });
}
