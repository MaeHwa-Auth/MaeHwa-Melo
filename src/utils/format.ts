import { convertFileSrc } from "@tauri-apps/api/core";

export const formatTime = (seconds: number): string => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0")}`;

export const esc = (value: string): string => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

export const safeUrl = (value?: string): string => value
  ? value.startsWith("http:") || value.startsWith("https:") || value.startsWith("data:") || value.startsWith("asset:")
    ? value
    : convertFileSrc(value)
  : "";
