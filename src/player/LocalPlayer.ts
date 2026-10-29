import { convertFileSrc } from "@tauri-apps/api/core";
import type { PlaybackSnapshot, PlayerAdapter, Track } from "../types";

export type SnapshotListener = (snapshot: PlaybackSnapshot) => void;

export class LocalPlayer implements PlayerAdapter {
  readonly audio = new Audio();
  private tracks: Track[] = [];
  private index = -1;
  private snapshot: PlaybackSnapshot = { current: null, playing: false, position: 0, duration: 0, volume: 0.72, shuffle: false, repeat: "off", queue: [] };
  private listeners = new Set<SnapshotListener>();

  constructor() {
    this.audio.preload = "metadata";
    this.audio.volume = this.snapshot.volume;
    this.audio.addEventListener("timeupdate", this.onTime);
    this.audio.addEventListener("durationchange", this.onDuration);
    this.audio.addEventListener("play", this.onPlay);
    this.audio.addEventListener("pause", this.onPause);
    this.audio.addEventListener("ended", this.onEnded);
    this.audio.addEventListener("error", this.onError);
  }

  subscribe(listener: SnapshotListener): () => void { this.listeners.add(listener); listener(this.snapshot); return () => this.listeners.delete(listener); }
  private update(patch: Partial<PlaybackSnapshot>): void { this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach((listener) => listener(this.snapshot)); }
  private onTime = (): void => this.update({ position: this.audio.currentTime });
  private onDuration = (): void => this.update({ duration: Number.isFinite(this.audio.duration) ? this.audio.duration : 0 });
  private onPlay = (): void => this.update({ playing: true });
  private onPause = (): void => this.update({ playing: false });
  private onEnded = (): void => { this.update({ playing: false, position: this.snapshot.duration }); window.dispatchEvent(new CustomEvent("maehwa:local-ended")); };
  private onError = (): void => { this.update({ playing: false }); window.dispatchEvent(new CustomEvent("maehwa:notice", { detail: "파일을 재생할 수 없습니다. 이동되었거나 지원되지 않는 형식일 수 있습니다." })); };

  setTracks(tracks: Track[]): void { this.tracks = tracks; this.update({ queue: tracks.filter((_, index) => index > this.index) }); }
  updateCurrentTrack(track: Track): void {
    if (this.snapshot.current && (this.snapshot.current.id === track.id || this.snapshot.current.localPath === track.localPath)) {
      this.snapshot.current = { ...this.snapshot.current, ...track };
      this.update({ current: this.snapshot.current });
    }
  }
  async play(track: Track): Promise<void> {
    if (track.source !== "local" || !track.localPath) throw new Error("로컬 오디오 경로가 없습니다.");
    const index = this.tracks.findIndex((item) => item.id === track.id);
    if (index >= 0) this.index = index;
    else { this.tracks = [track]; this.index = 0; }
    this.audio.src = track.localPath.startsWith("blob:") ? track.localPath : convertFileSrc(track.localPath);
    this.update({ current: track, position: 0, duration: track.duration ?? 0, queue: this.tracks.slice(this.index + 1) });
    await this.audio.play();
  }
  prepare(track: Track, position: number): void {
    if (track.source !== "local" || !track.localPath) return;
    const index = this.tracks.findIndex((item) => item.id === track.id);
    if (index >= 0) this.index = index;
    else { this.tracks = [track]; this.index = 0; }
    const src = track.localPath.startsWith("blob:") ? track.localPath : convertFileSrc(track.localPath);
    if (this.audio.src !== src) this.audio.src = src;
    const seekToSavedPosition = (): void => {
      if (Number.isFinite(this.audio.duration)) this.audio.currentTime = Math.max(0, Math.min(position, this.audio.duration));
    };
    if (this.audio.readyState >= HTMLMediaElement.HAVE_METADATA) seekToSavedPosition();
    else this.audio.addEventListener("loadedmetadata", seekToSavedPosition, { once: true });
    this.update({ current: track, playing: false, position, duration: track.duration ?? 0, queue: this.tracks.slice(this.index + 1) });
    if (this.audio.readyState === HTMLMediaElement.HAVE_NOTHING) this.audio.load();
  }
  async pause(): Promise<void> { this.audio.pause(); }
  async resume(): Promise<void> { await this.audio.play(); }
  async seek(seconds: number): Promise<void> { if (Number.isFinite(this.audio.duration)) this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration)); }
  async setVolume(volume: number): Promise<void> { this.audio.volume = Math.max(0, Math.min(1, volume)); this.update({ volume: this.audio.volume }); }
  async setShuffle(enabled: boolean): Promise<void> { this.update({ shuffle: enabled }); }
  async setRepeat(mode: PlaybackSnapshot["repeat"]): Promise<void> { this.update({ repeat: mode }); }
  async next(): Promise<void> {
    if (!this.tracks.length) return;
    if (this.snapshot.shuffle && this.tracks.length > 1) { const choices = this.tracks.map((_, index) => index).filter((index) => index !== this.index); this.index = choices[Math.floor(Math.random() * choices.length)]; }
    else this.index = (this.index + 1) % this.tracks.length;
    await this.play(this.tracks[this.index]);
  }
  async previous(): Promise<void> { if (this.audio.currentTime > 3) { await this.seek(0); return; } if (!this.tracks.length) return; this.index = (this.index - 1 + this.tracks.length) % this.tracks.length; await this.play(this.tracks[this.index]); }
  destroy(): void {
    this.audio.pause(); this.audio.removeAttribute("src"); this.audio.load();
    this.audio.removeEventListener("timeupdate", this.onTime); this.audio.removeEventListener("durationchange", this.onDuration);
    this.audio.removeEventListener("play", this.onPlay); this.audio.removeEventListener("pause", this.onPause);
    this.audio.removeEventListener("ended", this.onEnded); this.audio.removeEventListener("error", this.onError); this.listeners.clear();
  }
}
