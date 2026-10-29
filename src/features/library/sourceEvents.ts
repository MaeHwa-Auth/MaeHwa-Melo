interface LibrarySourceEventsOptions {
  app: HTMLElement;
  addFolder: () => void;
  addFiles: () => void;
  connect: () => void;
  disconnect: () => void;
  rescan: (folder: string) => void;
}

export function bindLibrarySourceEvents(options: LibrarySourceEventsOptions): void {
  options.app.querySelectorAll<HTMLElement>("[data-add-folder]").forEach((element) => element.addEventListener("click", options.addFolder));
  options.app.querySelectorAll<HTMLElement>("[data-add-files]").forEach((element) => element.addEventListener("click", options.addFiles));
  options.app.querySelectorAll<HTMLElement>("[data-connect]").forEach((element) => element.addEventListener("click", options.connect));
  options.app.querySelector<HTMLElement>("[data-disconnect]")?.addEventListener("click", options.disconnect);
  options.app.querySelectorAll<HTMLElement>("[data-rescan]").forEach((element) => element.addEventListener("click", () => options.rescan(element.dataset.rescan!)));
}
