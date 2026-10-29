import { spotifySearch } from "../../services/spotify";
import type { Track } from "../../types";

interface SpotifySearchOptions {
  query: () => string;
  connected: () => boolean;
  setTracks: (tracks: Track[]) => void;
  setLoading: (loading: boolean) => void;
  paint: () => void;
  showNotice: (message: string) => void;
}

export function createSpotifySearch(options: SpotifySearchOptions) {
  let sequence = 0;
  let timer = 0;

  function cancelPending(): void {
    sequence++;
    window.clearTimeout(timer);
  }

  async function search(value: string): Promise<void> {
    const query = value.trim();
    const requestSequence = ++sequence;
    window.clearTimeout(timer);
    options.setTracks([]);
    options.setLoading(Boolean(query && options.connected()));
    options.paint();
    if (!query || !options.connected()) return;
    await new Promise<void>((resolve) => { timer = window.setTimeout(resolve, 300); });
    if (requestSequence !== sequence) return;
    try {
      const results = await spotifySearch(query);
      if (requestSequence !== sequence || options.query().trim() !== query) return;
      options.setTracks(results);
    } catch (error) {
      if (requestSequence !== sequence) return;
      options.setLoading(false);
      options.paint();
      options.showNotice(error instanceof Error ? error.message : "Spotify 검색에 실패했습니다.");
      return;
    }
    options.setLoading(false);
    options.paint();
  }

  return { search, cancelPending };
}
