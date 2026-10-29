import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Track } from "../types";

// Constants
const TOKEN_KEY = "maehwa.spotify.tokens.v1";
const PKCE_KEY = "maehwa.spotify.pkce";
const SPOTIFY_REDIRECT_PORT = 43821;
const SPOTIFY_REDIRECT_URI = `http://127.0.0.1:${SPOTIFY_REDIRECT_PORT}`;
const SPOTIFY_CLIENT_ID = (import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? "").trim();
const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-private",
  "user-follow-read",
  "user-top-read",
  "user-library-read",
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-read-playback-state",
  "user-modify-playback-state",
];

// Types
interface Tokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
}

interface SpotifyRawTrack {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  artists: { id?: string; uri?: string; name: string }[];
  album: { id?: string; name: string; images?: { url: string }[]; artists?: { id?: string; name: string }[]; release_date?: string };
  track_number?: number;
  type?: string;
}

interface SpotifyPage<T> {
  items: T[];
  next: string | null;
}

interface SpotifyPlaylistItem {
  track?: SpotifyRawTrack | null;
  item?: SpotifyRawTrack | null;
  is_local?: boolean;
  added_at?: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  uri: string;
  description?: string;
  images?: { url: string }[];
  owner?: { display_name?: string };
  tracks?: { total?: number };
  public?: boolean | null;
}

interface SpotifySdkPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(name: string, listener: (value: unknown) => void): boolean;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  nextTrack(): Promise<void>;
  previousTrack(): Promise<void>;
  togglePlay(): Promise<void>;
  activateElement(): Promise<void>;
  getCurrentState(): Promise<SpotifySdkState | null>;
}

interface SpotifySdkState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: { current_track: SpotifySdkTrack };
}

interface SpotifySdkTrack {
  uri: string;
  name: string;
  artists: { name: string; uri?: string }[];
  album: { name: string; images?: { url: string }[] };
}

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string;
        volume: number;
        getOAuthToken: (callback: (token: string) => void) => void;
      }) => SpotifySdkPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

// Utilities
function log(message: string): void {
  void invoke("write_debug_log", { message }).catch(() => undefined);
}

function randomString(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

// Token Management
function readTokens(): Tokens | null {
  try {
    const value = localStorage.getItem(TOKEN_KEY);
    return value ? (JSON.parse(value) as Tokens) : null;
  } catch {
    return null;
  }
}

function writeTokens(tokens: Tokens): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PKCE_KEY);
}

async function refreshAccessToken(refreshToken: string): Promise<Tokens> {
  const currentTokens = readTokens();
  
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: SPOTIFY_CLIENT_ID,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope?: string;
  };

  const tokens: Tokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: currentTokens?.scope || data.scope,
  };

  writeTokens(tokens);
  return tokens;
}

// Public API
export function spotifyClientId(): string {
  return SPOTIFY_CLIENT_ID;
}

export function hasSpotifyClientId(): boolean {
  return Boolean(SPOTIFY_CLIENT_ID);
}

export function spotifyConnected(): boolean {
  const tokens = readTokens();
  return Boolean(tokens && (tokens.refreshToken || tokens.expiresAt > Date.now()));
}

export function spotifyHasPlaylistWriteScope(): boolean {
  const scopes = (readTokens()?.scope ?? "").split(/\s+/);
  return scopes.includes("playlist-modify-private") && scopes.includes("playlist-modify-public");
}

export function disconnectSpotify(): void {
  clearTokens();
}

export async function loginSpotify(): Promise<void> {
  if (!SPOTIFY_CLIENT_ID) {
    throw new Error(
      "Spotify Client ID not configured. Check .env.local and VITE_SPOTIFY_CLIENT_ID."
    );
  }

  clearTokens();
  log("[Spotify OAuth] Login started");

  // Start callback listener
  let port: number;
  try {
    port = await invoke<number>("start_spotify_callback");
    log(`[Spotify OAuth] Callback listener started on port ${port}`);
  } catch (error) {
    const msg = errorText(error);
    log(`[Spotify OAuth] Failed to start callback listener: ${msg}`);
    throw new Error(`Failed to start OAuth callback listener: ${msg}`);
  }

  // Generate PKCE
  const verifier = randomString(48);
  const challenge = base64Url(await sha256(verifier));
  localStorage.setItem(PKCE_KEY, verifier);
  log(`[Spotify OAuth] PKCE generated`);

  // Generate state
  const state = randomString(16);

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES.join(" "),
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
  });

  const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
  log(`[Spotify OAuth] Authorization URL generated`);

  // Open browser
  try {
    await openUrl(authUrl);
    log("[Spotify OAuth] Browser opened");
  } catch (error) {
    const msg = errorText(error);
    log(`[Spotify OAuth] Failed to open browser: ${msg}`);
    throw new Error(`Failed to open browser: ${msg}`);
  }

  // Wait for callback
  let callbackResponse: string;
  try {
    callbackResponse = await invoke<string>("wait_spotify_callback", { port });
    log("[Spotify OAuth] Callback received");
  } catch (error) {
    const msg = errorText(error);
    log(`[Spotify OAuth] Callback timeout/error: ${msg}`);
    throw new Error(`OAuth callback failed: ${msg}`);
  }

  const [code, returnedState] = callbackResponse.split("\t");

  if (code.startsWith("error:")) {
    log(`[Spotify OAuth] Authorization denied: ${code}`);
    throw new Error(`Authorization denied: ${code.slice(6)}`);
  }

  if (!code || !returnedState) {
    log(`[Spotify OAuth] Invalid callback: code=${Boolean(code)}, state=${Boolean(returnedState)}`);
    throw new Error("Invalid callback response: missing code or state");
  }

  if (returnedState !== state) {
    log(`[Spotify OAuth] State mismatch: expected=${state}, got=${returnedState}`);
    throw new Error("State validation failed");
  }

  // Exchange code for tokens
  const verifierFromStorage = localStorage.getItem(PKCE_KEY);
  if (!verifierFromStorage) {
    throw new Error("PKCE verifier not found");
  }

  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    client_id: SPOTIFY_CLIENT_ID,
    code_verifier: verifierFromStorage,
  });

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    });
  } catch (error) {
    const msg = errorText(error);
    log(`[Spotify OAuth] Token exchange network error: ${msg}`);
    throw new Error(`Token exchange failed: ${msg}`);
  }

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    log(`[Spotify OAuth] Token exchange HTTP ${tokenResponse.status}: ${text}`);
    throw new Error(`Token exchange failed: ${tokenResponse.status}`);
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };

  const tokens: Tokens = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
    scope: tokenData.scope || SPOTIFY_SCOPES.join(" "),
  };

  writeTokens(tokens);
  log("[Spotify OAuth] Login successful");
}

// Spotify Request Helper
async function getValidToken(): Promise<string> {
  let tokens = readTokens();

  if (!tokens) {
    throw new Error("Not logged in to Spotify");
  }

  if (tokens.expiresAt <= Date.now()) {
    if (!tokens.refreshToken) {
      clearTokens();
      throw new Error("Access token expired and no refresh token available");
    }
    tokens = await refreshAccessToken(tokens.refreshToken);
  }

  if (!tokens.scope) {
    log("[WARNING] No scope found in token. Current token: " + JSON.stringify(tokens));
  }

  return tokens.accessToken;
}

async function spotifyRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  // If we recently received a 429 with Retry-After, short-circuit further
  // requests until the wait window has passed to avoid hammering the API.
  if (spotifyRateLimitUntil > Date.now()) {
    const remaining = Math.max(1, Math.ceil((spotifyRateLimitUntil - Date.now()) / 1000));
    throw new SpotifyRateLimitError(remaining);
  }
  const token = await getValidToken();
  const headers = {
    ...((options?.headers as Record<string, string>) ?? {}),
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(endpoint, { ...options, headers });

  if (!response.ok) {
    if (response.status === 401) {
      clearTokens();
      throw new Error("Access token expired or invalid");
    }
    if (response.status === 429) {
      const ra = response.headers.get("retry-after");
      const retryAfter = ra ? Math.max(1, parseInt(ra, 10) || 1) : 60;
      // Set global block window (add a small buffer)
      spotifyRateLimitUntil = Date.now() + (retryAfter + 1) * 1000;
      // Rate limit - surface a typed error so callers can react
      throw new SpotifyRateLimitError(retryAfter);
    }
    const text = await response.text();
    throw new Error(`Spotify API error ${response.status}: ${text}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return undefined as T;
  }

  const body = await response.text();
  if (!body) return undefined as T;
  try {
    return JSON.parse(body) as T;
  } catch (error) {
    // Successful Spotify playback commands can return a plain-text body even
    // when an intermediary labels it as JSON. The command itself has already
    // succeeded; do not report that as a playback failure.
    if (options?.method?.toUpperCase() === "PUT") return undefined as T;
    throw error;
  }
}

let playbackStateBackoffUntil = 0;
let playbackStateFailureCount = 0;

export class SpotifyRateLimitError extends Error {
  retryAfter: number;
  constructor(retryAfter: number) {
    super("Spotify API rate limit");
    this.retryAfter = retryAfter;
    this.name = "SpotifyRateLimitError";
  }
}

// Global rate-limit until timestamp (ms). Set when a 429 with Retry-After is received.
let spotifyRateLimitUntil = 0;

export function spotifyRateLimitRemaining(): number {
  return Math.max(0, Math.ceil((spotifyRateLimitUntil - Date.now()) / 1000));
}

// API Endpoints
function toTrack(raw: SpotifyRawTrack): Track {
  return {
    id: raw.uri,
    source: "spotify",
    title: raw.name,
    artist: raw.artists.map((item) => item.name).join(", "),
    artists: raw.artists.map((item) => item.name).filter((name) => name.trim()),
    artistIds: raw.artists.map((item) => item.id ?? item.uri?.split(":").at(-1) ?? ""),
    album: raw.album.name,
    albumId: raw.album.id,
    albumArtist: raw.album.artists?.map((item) => item.name).join(", "),
    year: raw.album.release_date ? Number(raw.album.release_date.slice(0, 4)) : undefined,
    artwork: raw.album.images?.[0]?.url,
    duration: raw.duration_ms / 1000,
    spotifyUri: raw.uri,
    trackNumber: raw.track_number,
  };
}

export interface SpotifyAlbumDetails {
  id: string;
  name: string;
  artist: string;
  artists?: string[];
  artistIds?: string[];
  artwork?: string;
  releaseDate?: string;
  tracks: Track[];
}

export interface SpotifyArtistProfile {
  id: string;
  name: string;
  image?: string;
  genres: string[];
  popularity?: number;
  followers?: number;
  spotifyUrl?: string;
  albums: { id: string; name: string; image?: string; releaseDate?: string; totalTracks?: number; spotifyUrl?: string }[];
}

interface SpotifyAlbumTrackRaw {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  artists: { id?: string; uri?: string; name: string }[];
  track_number?: number;
  disc_number?: number;
  type?: string;
}

export async function spotifyAlbumTracks(albumId: string): Promise<SpotifyAlbumDetails> {
  const album = await spotifyRequest<{
    id: string;
    name: string;
    images?: { url: string }[];
    artists?: { id?: string; name: string }[];
    release_date?: string;
    tracks?: { items?: SpotifyAlbumTrackRaw[]; next?: string | null };
  }>(`https://api.spotify.com/v1/albums/${encodeURIComponent(albumId)}?limit=50`);
  const rawTracks = [...(album.tracks?.items ?? [])];
  let next = album.tracks?.next ?? null;
  for (let page = 1; next && page < 10; page++) {
    const result = await spotifyRequest<{ items?: SpotifyAlbumTrackRaw[]; next?: string | null }>(next);
    rawTracks.push(...(result.items ?? []));
    next = result.next ?? null;
  }
  const artist = album.artists?.map((item) => item.name).join(", ") ?? "알 수 없는 아티스트";
  const year = album.release_date ? Number(album.release_date.slice(0, 4)) : undefined;
  return {
    id: album.id,
    name: album.name,
    artist,
    artists: album.artists?.map((item) => item.name).filter((name) => name.trim()),
    artistIds: album.artists?.map((item) => item.id ?? ""),
    artwork: album.images?.[0]?.url,
    releaseDate: album.release_date,
    tracks: rawTracks.filter((track) => track.type !== "episode").map((track) => ({
      id: track.uri,
      source: "spotify",
      title: track.name,
      artist: track.artists.map((item) => item.name).join(", "),
      artists: track.artists.map((item) => item.name).filter((name) => name.trim()),
      artistIds: track.artists.map((item) => item.id ?? item.uri?.split(":").at(-1) ?? ""),
      album: album.name,
      albumId: album.id,
      albumArtist: artist,
      artwork: album.images?.[0]?.url,
      duration: track.duration_ms / 1000,
      spotifyUri: track.uri,
      trackNumber: track.track_number,
      discNumber: track.disc_number,
      year,
    })),
  };
}

interface SpotifyLibraryItem {
  track: SpotifyRawTrack | null;
  added_at?: string;
}

export async function spotifyLibrary(): Promise<Track[]> {
  const all: SpotifyLibraryItem[] = [];
  let url: string | null = "https://api.spotify.com/v1/me/tracks?limit=50";
  for (let page = 0; url && page < 20; page++) {
    const result: SpotifyPage<SpotifyLibraryItem> = await spotifyRequest<SpotifyPage<SpotifyLibraryItem>>(
      url
    );
    all.push(...result.items.filter((item: SpotifyLibraryItem) => item.track));
    url = result.next;
  }
  return all.flatMap((item) => item.track ? [{ ...toTrack(item.track), addedAt: item.added_at }] : []);
}

export async function spotifyPlaylists(): Promise<SpotifyPlaylist[]> {
  const result = await spotifyRequest<SpotifyPage<SpotifyPlaylist>>(
    "https://api.spotify.com/v1/me/playlists?limit=50"
  );
  return result.items;
}

export async function spotifyCreatePlaylist(name: string, isPublic: boolean): Promise<SpotifyPlaylist> {
  return spotifyRequest<SpotifyPlaylist>("https://api.spotify.com/v1/me/playlists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, public: isPublic, collaborative: false }),
  });
}

export async function spotifyAddTrackToPlaylist(playlistId: string, trackUri: string): Promise<void> {
  await spotifyRequest<void>(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uris: [trackUri] }),
  });
}

export async function spotifyPlaylistTracks(playlistId: string): Promise<Track[]> {
  const result = await spotifyRequest<SpotifyPage<SpotifyPlaylistItem>>(
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(
      playlistId
    )}/items?limit=100`
  );

  const validTracks = (result.items ?? []).flatMap((item) => {
    const track = item?.track ?? item?.item ?? null;
    if (!track || !track.id) return [];
    return [{ ...toTrack(track), addedAt: item.added_at }];
  });

  const unique = new Map<string, Track>();
  for (const track of validTracks) unique.set(track.id, track);
  return [...unique.values()];
}

export async function spotifySearch(query: string): Promise<Track[]> {
  if (!query.trim()) return [];
  const result = await spotifyRequest<{
    tracks?: { items?: SpotifyRawTrack[] };
  }>(
    `https://api.spotify.com/v1/search?${new URLSearchParams({
      q: query,
      type: "track",
      limit: "10",
    })}`
  );
  return (result.tracks?.items ?? []).map(toTrack);
}

export async function spotifyTopTracks(time_range: "short_term" | "medium_term" | "long_term" = "short_term", limit = 10): Promise<Track[]> {
  const result = await spotifyRequest<{ items?: SpotifyRawTrack[] }>(
    `https://api.spotify.com/v1/me/top/tracks?${new URLSearchParams({ limit: String(limit), time_range })}`
  );
  return (result.items ?? []).map(toTrack);
}

export interface SpotifyTopArtist {
  id: string;
  name: string;
  image?: string;
}

export async function spotifyTopArtists(time_range: "short_term" | "medium_term" | "long_term" = "short_term", limit = 10): Promise<SpotifyTopArtist[]> {
  const result = await spotifyRequest(`https://api.spotify.com/v1/me/top/artists?${new URLSearchParams({ limit: String(limit), time_range })}`) as any;
  return (result.items ?? []).map((a: any) => ({ id: a.id, name: a.name, image: a.images?.[0]?.url }));
}

// Followed artists (artists the user follows)
export async function spotifyFollowingArtists(limit = 50): Promise<SpotifyTopArtist[]> {
  const result = await spotifyRequest(`https://api.spotify.com/v1/me/following?${new URLSearchParams({ type: "artist", limit: String(limit) })}`) as any;
  const items = result.artists?.items ?? [];
  return items.map((a: any) => ({ id: a.id, name: a.name, image: a.images?.[0]?.url }));
}

export async function spotifyArtistProfile(name: string, artistId?: string): Promise<SpotifyArtistProfile> {
  let id = artistId?.trim();
  if (!id) {
    const result = await spotifyRequest<{ artists?: { items?: { id: string; name: string }[] } }>(
      `https://api.spotify.com/v1/search?${new URLSearchParams({ q: `artist:"${name}"`, type: "artist", limit: "10" })}`,
    );
    const matches = result.artists?.items ?? [];
    const normalizedName = name.trim().toLocaleLowerCase();
    id = matches.find((artist) => artist.name.trim().toLocaleLowerCase() === normalizedName)?.id ?? matches[0]?.id;
  }
  if (!id) throw new Error(`Spotify에서 ${name} 아티스트를 찾지 못했습니다.`);

  const [artist, releases] = await Promise.all([
    spotifyRequest<{
      id: string; name: string; images?: { url: string }[]; genres?: string[];
      popularity?: number; followers?: { total?: number }; external_urls?: { spotify?: string };
    }>(`https://api.spotify.com/v1/artists/${encodeURIComponent(id)}`),
    spotifyRequest<{ items?: { id: string; name: string; images?: { url: string }[]; release_date?: string; total_tracks?: number; external_urls?: { spotify?: string } }[] }>(
      `https://api.spotify.com/v1/artists/${encodeURIComponent(id)}/albums?${new URLSearchParams({ include_groups: "album,single", limit: "10", market: "KR" })}`,
    ),
  ]);
  const seen = new Set<string>();
  const albums = (releases.items ?? []).filter((album) => {
    if (seen.has(album.id)) return false;
    seen.add(album.id);
    return true;
  }).map((album) => ({
    id: album.id,
    name: album.name,
    image: album.images?.[0]?.url,
    releaseDate: album.release_date,
    totalTracks: album.total_tracks,
    spotifyUrl: album.external_urls?.spotify,
  }));
  return {
    id: artist.id,
    name: artist.name,
    image: artist.images?.[0]?.url,
    genres: artist.genres ?? [],
    popularity: artist.popularity,
    followers: artist.followers?.total,
    spotifyUrl: artist.external_urls?.spotify,
    albums,
  };
}

export async function spotifyEarliestAlbumForTrack(track: Track): Promise<SpotifyAlbumDetails> {
  const query = `track:"${track.title.replaceAll('"', "")}" artist:"${track.artist.split(",")[0].replaceAll('"', "")}"`;
  const result = await spotifyRequest<{ tracks?: { items?: SpotifyRawTrack[] } }>(
    `https://api.spotify.com/v1/search?${new URLSearchParams({ q: query, type: "track", limit: "10" })}`
  );
  const normalize = (value: string): string => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "").trim();
  const title = normalize(track.title);
  const artist = normalize(track.artist.split(",")[0]);
  const matches = (result.tracks?.items ?? []).filter((item) =>
    normalize(item.name) === title && item.artists.some((itemArtist) => normalize(itemArtist.name).includes(artist)) && item.album.id
  );
  const best = matches.sort((a, b) => {
    const aDate = a.album.release_date || "9999";
    const bDate = b.album.release_date || "9999";
    return aDate.localeCompare(bDate);
  })[0];
  const albumId = best?.album.id ?? track.albumId;
  if (!albumId) throw new Error("이 곡의 Spotify 앨범 정보를 찾을 수 없습니다.");
  try {
    return await spotifyAlbumTracks(albumId);
  } catch (error) {
    const source = best ? toTrack(best) : track;
    if (!source.album || source.album === "Spotify") throw error;
    return {
      id: albumId,
      name: source.album,
      artist: source.albumArtist || source.artist,
      artwork: source.artwork,
      releaseDate: source.year ? String(source.year) : undefined,
      tracks: [source],
    };
  }
}

// Web Playback SDK
let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("Spotify 재생 모듈을 불러오지 못했습니다.")),
      12000
    );
    window.onSpotifyWebPlaybackSDKReady = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("Spotify Web Playback SDK 연결 실패"));
    };
    document.head.appendChild(script);
  });

  return sdkPromise;
}

function toSdkTrack(track: SpotifySdkTrack): Track {
  return {
    id: track.uri,
    source: "spotify",
    title: track.name,
    artist: track.artists.map((artist) => artist.name).join(", "),
    artists: track.artists.map((artist) => artist.name).filter((name) => name.trim()),
    artistIds: track.artists.map((artist) => artist.uri?.split(":").at(-1) ?? ""),
    album: track.album.name,
    artwork: track.album.images?.[0]?.url,
    spotifyUri: track.uri,
  };
}

export class SpotifyPlayer {
  private player: SpotifySdkPlayer | null = null;
  private deviceId = "";
  private ticker: number | undefined;

  async connect(
    onTrack: (
      track: Track | null,
      position: number,
      duration: number,
      playing: boolean
    ) => void,
    initialVolume = 0.72
  ): Promise<void> {
    this.destroy();

    try {
      await loadSdk();

      if (!window.Spotify || typeof window.Spotify.Player !== "function") {
        throw new Error("Spotify Web Playback SDK를 초기화할 수 없습니다.");
      }

      this.player = new window.Spotify.Player({
        name: "MaeHwa Melo",
        volume: Math.max(0, Math.min(1, initialVolume)),
        getOAuthToken: (callback) => {
          void getValidToken()
            .then(callback)
            .catch(() => callback(""));
        },
      });

      this.player.addListener("ready", (event) => {
        this.deviceId = (event as { device_id: string }).device_id;
        window.dispatchEvent(
          new CustomEvent("maehwa:notice", {
            detail: "Spotify Player 준비 완료 · Spotify Premium 필요",
          })
        );
      });

      this.player.addListener("not_ready", () => {
        this.deviceId = "";
      });

      this.player.addListener("account_error", () =>
        window.dispatchEvent(
          new CustomEvent("maehwa:notice", {
            detail: "Spotify Premium 계정으로 로그인해 주세요.",
          })
        )
      );

      this.player.addListener("authentication_error", (event) =>
        window.dispatchEvent(
          new CustomEvent("maehwa:notice", {
            detail: `Spotify 인증 오류: ${(event as { message: string }).message}`,
          })
        )
      );

      this.player.addListener("playback_error", (event) =>
        window.dispatchEvent(
          new CustomEvent("maehwa:notice", {
            detail: `Spotify 재생 오류: ${(event as { message: string }).message}`,
          })
        )
      );

      this.player.addListener("player_state_changed", (state) => {
        const current = state as SpotifySdkState | null;
        if (!current) {
          onTrack(null, 0, 0, false);
          return;
        }
        onTrack(
          toSdkTrack(current.track_window.current_track),
          current.position / 1000,
          current.duration / 1000,
          !current.paused
        );
      });

      const connected = await this.player.connect();
      if (!connected) {
        this.destroy();
        throw new Error("Spotify Player에 연결하지 못했습니다.");
      }

      this.ticker = window.setInterval(() => {
        void this.player?.getCurrentState().then((s) => {
          if (s) {
            onTrack(
              toSdkTrack(s.track_window.current_track),
              s.position / 1000,
              s.duration / 1000,
              !s.paused
            );
          }
        });
      }, 1000);
    } catch (error) {
      this.destroy();
      throw error instanceof Error ? error : new Error("Spotify 연결에 실패했습니다.");
    }
  }

  async play(track: Track, position = 0): Promise<void> {
    if (!this.player || !this.deviceId || !track.spotifyUri) {
      throw new Error("Spotify Player가 준비되지 않았습니다.");
    }

    await this.player.activateElement();
    // Target playback directly at the SDK device. A separate transfer request
    // races with /play on Spotify's backend and can leave the UI tracking a
    // different device from the one producing audio.
    await spotifyRequest<void>(
      `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(
        this.deviceId
      )}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uris: [track.spotifyUri], position_ms: Math.max(0, Math.floor(position * 1000)) }),
      }
    );
  }

  async pause(): Promise<void> {
    await spotifyRequest<void>("https://api.spotify.com/v1/me/player/pause", { method: "PUT" });
  }

  async resume(): Promise<void> {
    await spotifyRequest<void>("https://api.spotify.com/v1/me/player/play", { method: "PUT" });
  }

  async seek(seconds: number): Promise<void> {
    await this.player?.seek(seconds * 1000);
  }

  async setVolume(value: number): Promise<void> {
    await this.player?.setVolume(value);
  }

  async next(): Promise<void> {
    await this.player?.nextTrack();
  }

  async previous(): Promise<void> {
    await this.player?.previousTrack();
  }

  async shuffle(value: boolean): Promise<void> {
    await spotifyRequest<void>(
      `https://api.spotify.com/v1/me/player/shuffle?state=${value}`,
      { method: "PUT" }
    );
  }

  async repeat(value: "off" | "all" | "one"): Promise<void> {
    const spotifyRepeatState = value === "one" ? "track" : value === "all" ? "context" : "off";
    await spotifyRequest<void>(
      `https://api.spotify.com/v1/me/player/repeat?state=${spotifyRepeatState}`,
      { method: "PUT" }
    );
  }

  destroy(): void {
    if (this.ticker !== undefined) window.clearInterval(this.ticker);
    this.player?.disconnect();
    this.player = null;
  }
}

export async function getLivePlaybackState(): Promise<{
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  trackName: string;
  artistName: string;
  albumArt?: string;
  trackUri?: string;
} | null> {
  if (Date.now() < playbackStateBackoffUntil) return null;

  try {
    const token = await getValidToken();

    const response = await fetch("https://api.spotify.com/v1/me/player", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 204) {
      playbackStateFailureCount = 0;
      return null;
    }
    if (response.status === 429) {
      const retryAfterSeconds = Number(response.headers.get("Retry-After"));
      const exponentialDelaySeconds = Math.min(60, 2 ** Math.min(playbackStateFailureCount, 6));
      const delaySeconds = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds
        : exponentialDelaySeconds;
      playbackStateFailureCount += 1;
      playbackStateBackoffUntil = Date.now() + delaySeconds * 1000;
      console.warn(`Spotify playback polling rate limited; pausing for ${delaySeconds}s`);
      return null;
    }
    if (!response.ok) throw new Error(`Spotify state fetch failed: ${response.status}`);

    playbackStateFailureCount = 0;

    const data = (await response.json()) as {
      is_playing: boolean;
      progress_ms?: number;
      item?: {
        uri?: string;
        name?: string;
        duration_ms?: number;
        artists?: Array<{ name?: string }>;
        album?: { images?: Array<{ url?: string }> };
      } | null;
    };

    const item = data.item;
    if (!item) return null;

    return {
      isPlaying: data.is_playing,
      progressMs: data.progress_ms ?? 0,
      durationMs: item.duration_ms ?? 0,
      trackName: item.name ?? "Unknown Track",
      artistName:
        item.artists?.map((artist) => artist.name ?? "").filter(Boolean).join(", ") ??
        "Unknown Artist",
      albumArt: item.album?.images?.[0]?.url,
      trackUri: item.uri,
    };
  } catch (error) {
    console.error("Spotify live sync failed:", error);
    return null;
  }
}

// Current user profile
export async function spotifyCurrentUser(): Promise<{ id: string; display_name?: string; images?: { url: string }[] } | null> {
  try {
    const result = await spotifyRequest<{ id: string; display_name?: string; images?: { url: string }[] }>(
      "https://api.spotify.com/v1/me"
    );
    return result ?? null;
  } catch (error) {
    log(`[spotifyCurrentUser] failed: ${errorText(error)}`);
    return null;
  }
}
