import { chooseBrowserMusicFiles, chooseMusicFiles, chooseMusicFolder, isTauriRuntime, persistLibrary, scanFolder } from "../../services/library";
import type { Track } from "../../types";

interface LocalImportOptions {
  tracks: () => Track[];
  setTracks: (tracks: Track[]) => void;
  folders: () => string[];
  setFolders: (folders: string[]) => void;
  spotifyTracks: () => Track[];
  mergeTracks: (...groups: Track[][]) => Track[];
  persistLibrary: (folders: string[], tracks: Track[]) => void;
  setPlayerTracks: (tracks: Track[]) => void;
  showNotice: (message: string) => void;
  setLibraryPage: () => void;
  render: () => void;
}

export function createLocalImport(options: LocalImportOptions) {
  async function addFolder(): Promise<void> {
    try {
      if (!isTauriRuntime()) {
        const imported = await chooseBrowserMusicFiles(true);
        if (!imported.length) return;
        const tracks = options.mergeTracks(options.tracks(), imported);
        options.setTracks(tracks);
        options.setPlayerTracks(tracks.filter((track) => track.source === "local"));
        options.setLibraryPage();
        options.render();
        options.showNotice(`${imported.length}곡을 가져왔습니다. 브라우저 미리보기에서는 새로고침하면 다시 선택해야 합니다.`);
        return;
      }
      const folder = await chooseMusicFolder();
      if (!folder) return;
      const folders = options.folders().includes(folder) ? options.folders() : [...options.folders(), folder];
      options.setFolders(folders);
      const scanned = await scanFolder(folder);
      const tracks = options.mergeTracks(options.tracks(), scanned, options.spotifyTracks());
      options.setTracks(tracks);
      options.persistLibrary(folders, tracks);
      options.setPlayerTracks(tracks.filter((track) => track.source === "local"));
      options.showNotice(`${scanned.length}곡을 라이브러리에 추가했습니다.`);
      options.setLibraryPage();
      options.render();
    } catch (error) {
      options.showNotice(error instanceof Error ? error.message : "폴더를 읽지 못했습니다.");
    }
  }

  async function addAudioFiles(): Promise<void> {
    try {
      const tauriRuntime = isTauriRuntime();
      const imported = tauriRuntime ? await chooseMusicFiles() : await chooseBrowserMusicFiles(false);
      if (!imported.length) return;
      const tracks = options.mergeTracks(options.tracks(), imported);
      options.setTracks(tracks);
      options.setPlayerTracks(tracks.filter((track) => track.source === "local"));
      if (tauriRuntime) options.persistLibrary(options.folders(), tracks);
      options.setLibraryPage();
      options.render();
      options.showNotice(tauriRuntime ? `${imported.length}곡을 라이브러리에 추가했습니다.` : `${imported.length}곡을 가져왔습니다. 새로고침하면 다시 선택해야 합니다.`);
    } catch (error) {
      options.showNotice(error instanceof Error ? error.message : "음악 파일을 불러오지 못했습니다.");
    }
  }

  async function rescan(folder: string): Promise<void> {
    try {
      const prefix = folder.endsWith("\\") || folder.endsWith("/") ? folder : `${folder}\\`;
      const scanned = await scanFolder(folder);
      const tracks = options.mergeTracks(options.tracks().filter((track) => !(track.localPath === folder || track.localPath?.startsWith(prefix))), scanned, options.spotifyTracks());
      options.setTracks(tracks);
      options.persistLibrary(options.folders(), tracks);
      options.setPlayerTracks(tracks.filter((track) => track.source === "local"));
      options.showNotice("폴더를 갱신했습니다.");
      options.render();
    } catch (error) {
      options.showNotice(error instanceof Error ? error.message : "폴더를 갱신하지 못했습니다.");
    }
  }

  return { addFolder, addAudioFiles, rescan };
}
