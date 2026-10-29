import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Track } from "../types";

const FOLDERS_KEY = "maehwa.music.folders.v1";
const TRACKS_KEY = "maehwa.music.tracks.v1";
const FAVORITES_KEY = "maehwa.music.favorites.v1";
const FAVORITE_TRACKS_KEY = "maehwa.music.favorite-tracks.v1";
const MAX_LOCAL_ARTWORK_BYTES = 100 * 1024;

function compactTrackForStorage(track: Track): Track {
  if (track.localPath?.startsWith("blob:")) return { ...track, localPath: undefined };

  if (!track.artwork) return { ...track };

  if (track.source === "local" && track.artwork.startsWith("data:")) {
    const sizeEstimate = track.artwork.length;
    if (sizeEstimate > MAX_LOCAL_ARTWORK_BYTES) {
      return { ...track, artwork: undefined };
    }
  }

  return { ...track };
}

function compactTracksForStorage(tracks: Track[]): Track[] {
  return tracks.filter((track) => !track.localPath?.startsWith("blob:")).map(compactTrackForStorage);
}

export function savedFolders(): string[] { try { return JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? "[]") as string[]; } catch { return []; } }
export function savedTracks(): Track[] { 
  try { 
    const loaded = JSON.parse(localStorage.getItem(TRACKS_KEY) ?? "[]") as Track[];
    return loaded.filter((track) => !track.localPath?.startsWith("blob:"));
  } catch { 
    return []; 
  } 
}
export function favorites(): string[] { try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]") as string[]; } catch { return []; } }
export function saveFavorites(ids: string[]): void { localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids)); }
export function savedFavoriteTracks(): Track[] { try { return (JSON.parse(localStorage.getItem(FAVORITE_TRACKS_KEY) ?? "[]") as Track[]).filter((track) => !track.localPath?.startsWith("blob:")); } catch { return []; } }
export function saveFavoriteTracks(tracks: Track[]): void {
  const lightTracks = compactTracksForStorage(tracks);
  localStorage.setItem(FAVORITE_TRACKS_KEY, JSON.stringify(lightTracks));
}
export function persistLibrary(folders: string[], tracks: Track[]): void {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  const lightTracks = compactTracksForStorage(tracks);
  localStorage.setItem(TRACKS_KEY, JSON.stringify(lightTracks));
}
export async function chooseMusicFolder(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false, title: "음악 폴더 선택" });
  return typeof selected === "string" ? selected : null;
}
export async function chooseMusicFiles(): Promise<Track[]> {
  const selected = await open({ multiple: true, title: "음악 파일 선택", filters: [{ name: "오디오 파일", extensions: ["mp3", "flac", "wav", "m4a", "aac", "ogg", "opus", "aiff", "ape", "wv"] }] });
  const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
  return paths.length ? invoke<Track[]>("scan_music_files", { paths }) : [];
}
export function isTauriRuntime(): boolean { return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window; }
export async function chooseBrowserMusicFiles(directory = false): Promise<Track[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "audio/*,.mp3,.flac,.wav,.m4a,.aac,.ogg,.opus,.aiff,.ape,.wv";
    if (directory) input.setAttribute("webkitdirectory", "");
    let finished = false;
    const finish = (files: Track[]) => { if (finished) return; finished = true; input.remove(); resolve(files); };
    input.addEventListener("change", () => {
      const supported = new Set(["mp3", "flac", "wav", "m4a", "aac", "ogg", "opus", "aiff", "ape", "wv"]);
      const files = [...(input.files ?? [])].filter((file) => supported.has(file.name.split(".").pop()?.toLowerCase() ?? ""));
      finish(files.map((file, index) => {
        const relativeParts = (file as File & { webkitRelativePath?: string }).webkitRelativePath?.split("/") ?? [];
        return {
          id: `browser:${file.name}:${file.size}:${file.lastModified}:${index}`,
          source: "local",
          title: file.name.replace(/\.[^.]+$/, "") || file.name,
          artist: "",
          album: relativeParts.length > 2 ? relativeParts.at(-2)! : "",
          albumArtist: "",
          localPath: URL.createObjectURL(file),
          available: true,
        };
      }));
    }, { once: true });
    window.addEventListener("focus", () => window.setTimeout(() => { if (!finished && !input.files?.length) finish([]); }, 500), { once: true });
    input.click();
  });
}
export async function scanFolder(path: string): Promise<Track[]> { return invoke<Track[]>("scan_music_folder", { path }); }
export async function scanMusicFiles(paths: string[]): Promise<Track[]> { return paths.length ? invoke<Track[]>("scan_music_files", { paths }) : []; }
export async function rescanFolder(path: string): Promise<Track[]> { return invoke<Track[]>("scan_music_folder", { path }); }
