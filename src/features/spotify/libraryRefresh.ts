import { spotifyLibrary, spotifyPlaylists, spotifyRateLimitRemaining, SpotifyRateLimitError } from "../../services/spotify";
import type { Track } from "../../types";
import type { persistLibrary } from "../../services/library";

type SpotifyPlaylist = Awaited<ReturnType<typeof spotifyPlaylists>>[number];

interface SpotifyLibraryRefreshOptions {
  folders: () => string[];
  tracks: () => Track[];
  setSpotifyTracks: (tracks: Track[]) => void;
  setTracks: (tracks: Track[]) => void;
  setSpotifyPlaylistList: (playlists: SpotifyPlaylist[]) => void;
  mergeTracks: (...groups: Track[][]) => Track[];
  persistLibrary: typeof persistLibrary;
  showNotice: (message: string) => void;
}

let spotifyLibraryRefreshPromise: Promise<void> | null = null;
let spotifyLibraryRefreshScheduledAt = 0;

export function createSpotifyLibraryRefresh(options: SpotifyLibraryRefreshOptions) {
  return async function refreshSpotifyLibrary(): Promise<void> {
    const remaining = spotifyRateLimitRemaining();
    if (remaining > 0) {
      const now = Date.now();
      const nextDelay = Math.max(1000, (remaining + 1) * 1000);
      if (!spotifyLibraryRefreshPromise && now - spotifyLibraryRefreshScheduledAt > nextDelay) {
        spotifyLibraryRefreshScheduledAt = now;
        spotifyLibraryRefreshPromise = new Promise((resolve) => {
          setTimeout(() => {
            spotifyLibraryRefreshPromise = null;
            void refreshSpotifyLibrary().finally(resolve);
          }, nextDelay);
        });
      }
      return;
    }

    if (spotifyLibraryRefreshPromise) return;

    spotifyLibraryRefreshPromise = (async () => {
      const spotifyTracks = await spotifyLibrary();
      options.setSpotifyTracks(spotifyTracks);
      options.setTracks(options.mergeTracks(options.tracks().filter((track) => track.source === "local"), spotifyTracks));
      try {
        options.setSpotifyPlaylistList(await spotifyPlaylists());
      } catch (error) {
        if (error instanceof SpotifyRateLimitError) {
          const retryDelay = Math.max(1000, (error.retryAfter + 1) * 1000);
          options.showNotice(`Spotify 요청이 제한되어 있습니다. ${error.retryAfter}초 후에 재시도합니다.`);
          spotifyLibraryRefreshScheduledAt = Date.now();
          setTimeout(() => {
            spotifyLibraryRefreshPromise = null;
            void refreshSpotifyLibrary();
          }, retryDelay);
          return;
        }
        options.showNotice(error instanceof Error ? `Spotify 플레이리스트를 읽을 수 없습니다: ${error.message}` : "Spotify 플레이리스트 조회에 실패했습니다.");
      }
      options.persistLibrary(options.folders(), options.tracks());
    })();

    try {
      await spotifyLibraryRefreshPromise;
    } finally {
      spotifyLibraryRefreshPromise = null;
    }
  };
}
