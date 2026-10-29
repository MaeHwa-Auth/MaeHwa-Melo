import { spotifyCreatePlaylist } from "../../services/spotify";

interface CreatedPlaylist {
  id: string;
  name: string;
}

interface CreatePlaylistOptions {
  isBusy: () => boolean;
  setBusy: (busy: boolean) => void;
  disableSubmit: () => void;
  ensureWriteScope: () => Promise<void>;
  addPlaylist: (playlist: CreatedPlaylist) => void;
  selectPlaylist: (playlist: CreatedPlaylist) => void;
  render: () => void;
  showNotice: (message: string) => void;
}

export function createSpotifyPlaylistCreator(options: CreatePlaylistOptions) {
  return async function createSpotifyPlaylist(name: string, isPublic: boolean): Promise<void> {
    if (options.isBusy()) return;
    options.setBusy(true);
    options.disableSubmit();
    try {
      await options.ensureWriteScope();
      const playlist = await spotifyCreatePlaylist(name, isPublic);
      options.addPlaylist(playlist);
      options.selectPlaylist(playlist);
      options.setBusy(false);
      options.render();
      options.showNotice(`새 플레이리스트 「${playlist.name}」을(를) 만들었습니다.`);
    } catch (error) {
      options.setBusy(false);
      options.render();
      options.showNotice(error instanceof Error ? error.message : "플레이리스트를 만들지 못했습니다.");
    }
  };
}
