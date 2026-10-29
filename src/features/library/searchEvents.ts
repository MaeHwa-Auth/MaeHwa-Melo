interface LibrarySearchEventsOptions {
  app: HTMLElement;
  setLibraryQuery: (query: string) => void;
  searchLibrary: (query: string, caret: number) => void;
  setAlbumQuery: (query: string) => void;
  render: () => void;
}

export function bindLibrarySearchEvents(options: LibrarySearchEventsOptions): void {
  options.app.querySelector<HTMLInputElement>("#library-search")?.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;
    options.setLibraryQuery(input.value);
    const caret = input.selectionStart ?? input.value.length;
    options.searchLibrary(input.value, caret);
  });

  const albumSearch = options.app.querySelector<HTMLInputElement>("#album-search");
  const updateAlbumSearch = (input: HTMLInputElement): void => {
    options.setAlbumQuery(input.value);
    const caret = input.selectionStart ?? input.value.length;
    options.render();
    const restoredInput = options.app.querySelector<HTMLInputElement>("#album-search");
    restoredInput?.focus();
    restoredInput?.setSelectionRange(caret, caret);
  };
  albumSearch?.addEventListener("input", (event) => {
    if (!(event as InputEvent).isComposing) updateAlbumSearch(event.currentTarget as HTMLInputElement);
  });
  albumSearch?.addEventListener("compositionend", (event) => updateAlbumSearch(event.currentTarget as HTMLInputElement));
}
