import { loginSpotify } from "../../services/spotify";
import type { SpotifyPlayer } from "../../services/spotify";
import type { Track } from "../../types";

interface SpotifyConnectionOptions {
  isReady: () => boolean;
  setReady: (ready: boolean) => void;
  isConnected: () => boolean;
  player: SpotifyPlayer;
  onPlaybackUpdate: (track: Track | null, position: number, duration: number, playing: boolean) => void;
  initialVolume: () => number;
  refreshLibrary: () => Promise<void>;
  loadLikedSongs: (switchPage: boolean) => Promise<void>;
  setSpotifyLibraryPage: () => void;
  render: () => void;
  showNotice: (message: string) => void;
}

export function createSpotifyConnection(options: SpotifyConnectionOptions) {
  return async function connectSpotify(switchPage = true): Promise<void> {
    if (options.isReady()) {
      if (switchPage) {
        options.setSpotifyLibraryPage();
        options.render();
      }
      return;
    }
    try {
      if (!options.isConnected()) await loginSpotify();
      options.setReady(false);
      await options.player.connect(options.onPlaybackUpdate, options.initialVolume());
      options.setReady(true);
      await options.player.setVolume(options.initialVolume());
      await options.refreshLibrary();
      await options.loadLikedSongs(switchPage);
      if (switchPage) options.setSpotifyLibraryPage();
      options.render();
      options.showNotice("Spotify Premium Player에 연결했습니다.");
    } catch (error) {
      options.setReady(false);
      options.player.destroy();
      if (error instanceof Error && error.message.includes("Spotify")) options.showNotice(error.message);
      else options.showNotice(typeof error === "string" ? error : "Spotify 연결에 실패했습니다.");
      options.render();
    }
  };
}

export async function autoConnectSpotifyOnBoot(isConnected: boolean, isReady: boolean, connect: (switchPage: boolean) => Promise<void>): Promise<void> {
  if (!isConnected || isReady) return;
  try {
    await connect(false);
  } catch {
    // connect() already handles the notice and UI state.
  }
}
