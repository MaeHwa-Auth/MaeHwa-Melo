import type { Track } from "../../types";
import type { TrackLyrics } from "../../services/lrclib";

interface LyricsLoaderOptions {
  enabled: () => boolean;
  panelOpen: () => boolean;
  current: () => Track | null;
  trackId: () => string;
  setTrackId: (id: string) => void;
  isLoading: () => boolean;
  loading: (value: boolean) => void;
  lyrics: () => TrackLyrics | null;
  hasError: () => boolean;
  setLyrics: (lyrics: TrackLyrics | null) => void;
  setError: (value: boolean) => void;
  resetActiveIndex: () => void;
  findLyrics: (track: Track, signal: AbortSignal) => Promise<TrackLyrics | null>;
  updateCard: () => void;
}

export function createLyricsLoader(options: LyricsLoaderOptions): { load: () => Promise<void>; abort: () => void } {
  let controller: AbortController | null = null;

  function abort(): void {
    controller?.abort();
    controller = null;
    options.loading(false);
  }

  async function load(): Promise<void> {
    const track = options.current();
    if (!options.enabled() || !options.panelOpen() || !track || (options.trackId() === track.id && (options.isLoading() || options.lyrics() || options.hasError()))) return;
    controller?.abort();
    const request = new AbortController();
    controller = request;
    options.setTrackId(track.id);
    options.loading(true);
    options.setLyrics(null);
    options.setError(false);
    options.resetActiveIndex();
    options.updateCard();
    try {
      const result = await options.findLyrics(track, request.signal);
      if (request.signal.aborted || options.current()?.id !== track.id) return;
      options.setLyrics(result);
    } catch {
      if (request.signal.aborted || options.current()?.id !== track.id) return;
      options.setError(true);
    } finally {
      if (!request.signal.aborted && options.current()?.id === track.id) {
        options.loading(false);
        options.updateCard();
      }
    }
  }

  return { load, abort };
}
