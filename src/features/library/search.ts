import { spotifySearch, spotifyConnected } from "../../services/spotify";
import type { Track } from "../../types";

interface LibrarySearchOptions {
  query: () => string;
  setTracks: (tracks: Track[]) => void;
  render: () => void;
  getInput: () => HTMLInputElement | null;
}

export function createLibrarySearch(options: LibrarySearchOptions) {
  let sequence = 0;
  let timer = 0;

  function cancel(): void {
    sequence++;
    window.clearTimeout(timer);
  }

  async function search(value: string, caret: number): Promise<void> {
    const query = value.trim();
    const requestSequence = ++sequence;
    options.setTracks([]);
    options.render();
    const input = options.getInput();
    input?.focus();
    input?.setSelectionRange(caret, caret);
    if (!query || !spotifyConnected()) return;
    window.clearTimeout(timer);
    await new Promise<void>((resolve) => { timer = window.setTimeout(resolve, 350); });
    if (requestSequence !== sequence) return;
    try {
      const results = await spotifySearch(query);
      if (requestSequence !== sequence || options.query().trim() !== query) return;
      options.setTracks(results);
      options.render();
      const restoredInput = options.getInput();
      restoredInput?.focus();
      restoredInput?.setSelectionRange(caret, caret);
    } catch {
      // Local library filtering remains available when Spotify search is offline.
    }
  }

  return { search, cancel };
}
