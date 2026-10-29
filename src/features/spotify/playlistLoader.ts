import { spotifyPlaylistTracks } from "../../services/spotify";
import type { Track } from "../../types";

interface PlaylistLoaderOptions {
  likedTracks: () => Track[];
  setSelectedPlaylistId: (id: string) => void;
  setSelectedPlaylistTracks: (tracks: Track[]) => void;
  setLibraryQuery: (query: string) => void;
  setFavoritesOnly: (enabled: boolean) => void;
  setFilter: (filter: "all" | "local" | "spotify") => void;
  setPage: (page: import("../../types").AppPage) => void;
  setPlayQueue: (tracks: Track[]) => void;
  setPlaybackPlaylistName: (name: string) => void;
  render: () => void;
  scrollToCurrentTrack: () => void;
  showNotice: (message: string) => void;
}

export function createPlaylistLoader(options: PlaylistLoaderOptions) {
  return async function loadPlaylist(id: string, notify = true, switchPage = true, autoScrollToTrack = false): Promise<void> {
    if (id === "liked-songs") {
      const tracks = [...options.likedTracks()];
      options.setSelectedPlaylistId(id);
      options.setSelectedPlaylistTracks(tracks);
      options.setLibraryQuery("");
      options.setFavoritesOnly(false);
      options.setFilter("spotify");
      if (switchPage) options.setPage("library");
      options.setPlayQueue(tracks);
      options.setPlaybackPlaylistName("좋아요 표시한 곡");
      options.render();
      if (autoScrollToTrack) options.scrollToCurrentTrack();
      if (notify) options.showNotice(`${tracks.length}곡의 좋아요 표시한 곡을 불러왔습니다.`);
      return;
    }

    try {
      console.log("[playlist] selecting", id);
      const playlistTracks = await spotifyPlaylistTracks(id);
      console.log("[playlist] fetched", playlistTracks.length, "tracks");
      options.setSelectedPlaylistId(id);
      options.setSelectedPlaylistTracks(playlistTracks);
      options.setFavoritesOnly(false);
      options.setFilter("spotify");
      if (switchPage) options.setPage("library");
      options.setPlayQueue(playlistTracks);
      options.render();
      if (autoScrollToTrack) options.scrollToCurrentTrack();
      if (!playlistTracks.length) {
        options.showNotice("이 플레이리스트에는 표시할 곡이 없습니다.");
        return;
      }
      options.showNotice(`${playlistTracks.length}곡의 플레이리스트를 불러왔습니다.`);
    } catch (error) {
      console.error("[playlist] failed", error);
      options.showNotice(error instanceof Error ? error.message : "플레이리스트 조회에 실패했습니다.");
    }
  };
}
