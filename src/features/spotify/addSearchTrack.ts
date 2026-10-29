import { spotifyAddTrackToPlaylist } from "../../services/spotify";
import type { Track } from "../../types";

interface SpotifyPlaylist {
  id: string;
  name: string;
  tracks?: { total?: number };
  [key: string]: unknown;
}

interface AddSearchTrackOptions {
  searchTracks: () => Track[];
  selectedPlaylistId: () => string | null;
  selectedPlaylistTracks: () => Track[];
  setSelectedPlaylistTracks: (tracks: Track[]) => void;
  playlists: () => SpotifyPlaylist[];
  setPlaylists: (playlists: SpotifyPlaylist[]) => void;
  setTargetTrackId: (trackId: string | null) => void;
  ensureWriteScope: () => Promise<void>;
  paintSearchDropdown: () => void;
  isLibraryPage: () => boolean;
  render: () => void;
  showNotice: (message: string) => void;
}

export function createAddSearchTrack(options: AddSearchTrackOptions) {
  return async function addSearchTrackToPlaylist(trackId: string, playlistId: string): Promise<void> {
    const track = options.searchTracks().find((item) => item.id === trackId);
    if (!track?.spotifyUri) {
      options.showNotice("Spotify 곡 정보를 찾을 수 없습니다.");
      return;
    }
    try {
      await options.ensureWriteScope();
      await spotifyAddTrackToPlaylist(playlistId, track.spotifyUri);
      const selectedPlaylistId = options.selectedPlaylistId();
      let selectedTracks = options.selectedPlaylistTracks();
      if (selectedPlaylistId === playlistId && !selectedTracks.some((item) => item.id === track.id)) {
        selectedTracks = [...selectedTracks, track];
        options.setSelectedPlaylistTracks(selectedTracks);
      }
      options.setPlaylists(options.playlists().map((playlist) => playlist.id === playlistId
        ? { ...playlist, tracks: { total: (playlist.tracks?.total ?? (selectedPlaylistId === playlistId ? selectedTracks.length - 1 : 0)) + 1 } }
        : playlist));
      options.setTargetTrackId(null);
      options.paintSearchDropdown();
      if (options.isLibraryPage()) options.render();
      options.showNotice(`「${track.title}」을(를) 플레이리스트에 추가했습니다.`);
    } catch (error) {
      options.showNotice(error instanceof Error ? error.message : "곡을 플레이리스트에 추가하지 못했습니다.");
    }
  };
}
