import { scanFolder, scanMusicFiles, persistLibrary } from "../../services/library";
import type { Track } from "../../types";

interface LibraryBootOptions {
  tracks: () => Track[];
  setTracks: (tracks: Track[]) => void;
  folders: () => string[];
  spotifyTracks: () => Track[];
  mergeTracks: (...groups: Track[][]) => Track[];
  setPlayerTracks: (tracks: Track[]) => void;
  setIntroStatus: (status: string) => void;
  restorePlayback: () => void;
  render: () => void;
  dismissIntro: () => void;
  spotifyConnected?: () => boolean;
  refreshSpotifyLibrary?: () => Promise<void>;
}

export function createLibraryBoot(options: LibraryBootOptions) {
  return async function bootLibrary(): Promise<void> {
    options.setIntroStatus("라이브러리 불러오는 중...");

    if (options.spotifyConnected?.() && options.refreshSpotifyLibrary) {
      try {
        options.setIntroStatus("Spotify 라이브러리 동기화 중...");
        await options.refreshSpotifyLibrary();
      } catch {
        // Keep local boot flow running even if Spotify refresh fails.
      }
    }

    const previousTracks = options.tracks();
    const folders = options.folders();
    const hasLocalFiles = previousTracks.some((track) => track.source === "local" && track.localPath);
    if (!folders.length && !hasLocalFiles) {
      options.setIntroStatus("플레이어 환경 설정 중...");
      options.restorePlayback();
      options.render();
      options.dismissIntro();
      return;
    }
    const recovered: Track[] = [];
    for (const folder of folders) {
      try {
        options.setIntroStatus(`폴더 검색 중: ${folder.split(/[\\/]/).pop() || folder}`);
        recovered.push(...await scanFolder(folder));
      } catch {
        // Keep folders saved so users can reconnect a temporarily unavailable drive.
      }
    }
    const folderTracks = previousTracks.filter((track) => track.source === "local" && track.localPath && folders.some((folder) => track.localPath === folder || track.localPath!.startsWith(folder.endsWith("\\") || folder.endsWith("/") ? folder : `${folder}\\`)));
    const individuallySelected = previousTracks.filter((track) => track.source === "local" && track.localPath && !folderTracks.some((folderTrack) => folderTrack.id === track.id)).map((track) => track.localPath!);
    try {
      if (individuallySelected.length) options.setIntroStatus("개별 음악 파일 확인 중...");
      recovered.push(...await scanMusicFiles(individuallySelected));
    } catch {
      // Keep saved tracks visible if a selected file is temporarily unavailable.
    }
    const foundPaths = new Set(recovered.map((track) => track.localPath));
    const missing = previousTracks.filter((track) => track.source === "local" && track.localPath && !foundPaths.has(track.localPath)).map((track) => ({ ...track, available: false }));
    const tracks = options.mergeTracks(recovered, missing, options.spotifyTracks());
    options.setTracks(tracks);
    persistLibrary(folders, tracks);
    options.setPlayerTracks(tracks.filter((track) => track.source === "local"));
    options.setIntroStatus("재생 세션 복원 중...");
    options.restorePlayback();
    options.render();
    options.dismissIntro();
  };
}
