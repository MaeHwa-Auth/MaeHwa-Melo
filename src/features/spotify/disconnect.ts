import type { Track } from "../../types";

interface SpotifyDisconnectOptions {
  disconnect: () => void;
  destroyPlayer: () => void;
  setReady: (ready: boolean) => void;
  setSpotifyTracks: (tracks: Track[]) => void;
  tracks: () => Track[];
  setTracks: (tracks: Track[]) => void;
  folders: () => string[];
  persistLibrary: (folders: string[], tracks: Track[]) => void;
  render: () => void;
  showNotice: (message: string) => void;
  setSpotifyUser?: (user: any) => void;
  setTopTracks?: (items: Track[]) => void;
  setTopArtists?: (items: any[]) => void;
  setFollowing?: (items: any[]) => void;
}

export function createSpotifyDisconnect(options: SpotifyDisconnectOptions): () => void {
  return () => {
    options.disconnect();
    options.destroyPlayer();
    options.setReady(false);
    options.setSpotifyTracks([]);
    if (options.setSpotifyUser) options.setSpotifyUser(null);
    if (options.setTopTracks) options.setTopTracks([]);
    if (options.setTopArtists) options.setTopArtists([]);
    if (options.setFollowing) options.setFollowing([]);
    const tracks = options.tracks().filter((track) => track.source !== "spotify");
    options.setTracks(tracks);
    options.persistLibrary(options.folders(), tracks);
    options.render();
    options.showNotice("Spotify 연결을 해제했습니다.");
  };
}
