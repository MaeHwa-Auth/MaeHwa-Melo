import type { Track } from "../../types";

interface PlaySearchResultOptions {
  tracks: () => Track[];
  closeSearch: () => void;
  render: () => void;
  playTrack: (track: Track, queue: Track[], context: string) => Promise<void>;
}

export function createPlaySearchResult(options: PlaySearchResultOptions): (index: number) => Promise<void> {
  return async (index) => {
    const track = options.tracks()[index];
    if (!track) return;
    const queue = [...options.tracks()];
    options.closeSearch();
    options.render();
    await options.playTrack(track, queue, track.album || track.title);
  };
}
