interface PlaylistPermissionOptions {
  connected: () => boolean;
  hasWriteScope: () => boolean;
  login: () => Promise<void>;
  showNotice: (message: string) => void;
}

export function createPlaylistPermissionCheck(options: PlaylistPermissionOptions) {
  return async function ensurePlaylistWriteScope(): Promise<void> {
    if (!options.connected() || !options.hasWriteScope()) {
      options.showNotice(options.connected() ? "플레이리스트 저장 권한을 추가하려고 Spotify를 다시 연결합니다." : "Spotify에 연결합니다.");
      await options.login();
    }
    if (!options.connected() || !options.hasWriteScope()) throw new Error("Spotify 플레이리스트 수정 권한을 허용해 주세요.");
  };
}
