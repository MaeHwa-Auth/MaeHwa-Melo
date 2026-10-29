import type { Track } from "../types";

export interface LyricLine {
  time: number | null;
  endTime?: number | null;
  text: string;
  words?: { time: number; endTime?: number; text: string }[];
}

export interface TrackLyrics {
  lines: LyricLine[];
  synced: boolean;
  wordSynced?: boolean;
}

interface LrclibRecord {
  trackName?: string;
  artistName?: string;
  duration?: number;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
  lyricsfile?: string | null;
}

function yamlScalar(value: string): string {
  const scalar = value.trim();
  if (scalar.startsWith("'") && scalar.endsWith("'")) return scalar.slice(1, -1).replace(/''/g, "'");
  if (scalar.startsWith('"') && scalar.endsWith('"')) {
    try { return JSON.parse(scalar) as string; } catch { return scalar.slice(1, -1); }
  }
  return scalar;
}

function parseLyricsfile(value: string): LyricLine[] {
  const output: LyricLine[] = [];
  let inLines = false;
  let lineIndent = -1;
  let wordIndent = -1;
  let line: LyricLine | null = null;
  let word: { time: number; endTime?: number; text: string } | null = null;
  for (const raw of value.split(/\r?\n/)) {
    if (/^lines:\s*$/.test(raw)) { inLines = true; continue; }
    if (inLines && /^(plain|metadata|version):/.test(raw)) break;
    if (!inLines) continue;
    const item = raw.match(/^(\s*)-\s+text:\s*(.*)$/);
    if (item) {
      const indent = item[1].length;
      const text = yamlScalar(item[2]);
      if (lineIndent < 0 || indent === lineIndent) {
        lineIndent = indent;
        line = { time: null, text, words: [] };
        output.push(line);
        word = null;
        wordIndent = -1;
      } else if (line && indent > lineIndent) {
        wordIndent = indent;
        word = { time: 0, text };
        line.words!.push(word);
      }
      continue;
    }
    const property = raw.match(/^(\s*)(start_ms|end_ms):\s*(\d+)\s*$/);
    if (property && line) {
      const indent = property[1].length;
      const seconds = Number(property[3]) / 1000;
      if (word && indent > wordIndent) {
        if (property[2] === "start_ms") word.time = seconds;
        else word.endTime = seconds;
      } else if (indent > lineIndent) {
        if (property[2] === "start_ms") line.time = seconds;
        else line.endTime = seconds;
      }
    }
  }
  return output.filter((entry) => entry.time !== null).map((entry) => {
    const words = (entry.words ?? []).filter((part) => part.text && part.time >= 0).sort((a, b) => a.time - b.time);
    return { ...entry, words: words.length ? words.map((part, index) => ({ ...part, endTime: part.endTime ?? words[index + 1]?.time ?? entry.endTime ?? undefined })) : undefined };
  }).sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
}

function parseSyncedLyrics(value: string): LyricLine[] {
  return value.split(/\r?\n/).flatMap((rawLine) => {
    const timestamps = [...rawLine.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    const text = rawLine.replace(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g, "").trim();
    if (!text || timestamps.length === 0) return [];
    return timestamps.map((match) => ({
      time: Number(match[1]) * 60 + Number(match[2]) + Number(`0.${(match[3] ?? "0").padEnd(3, "0")}`),
      text,
    }));
  }).sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
}

function toLyrics(record: LrclibRecord): TrackLyrics | null {
  if (record.lyricsfile?.trim()) {
    const lyricsFileLines = parseLyricsfile(record.lyricsfile);
    if (lyricsFileLines.length) {
      const wordSynced = lyricsFileLines.some((line) => line.words?.length);
      return { lines: lyricsFileLines, synced: true, wordSynced };
    }
  }
  if (record.syncedLyrics?.trim()) {
    const lines = parseSyncedLyrics(record.syncedLyrics);
    if (lines.length) return { lines, synced: true };
  }
  const lines = (record.plainLyrics ?? "").split(/\r?\n/).map((text) => ({ time: null, text: text.trim() })).filter((line) => line.text);
  return lines.length ? { lines, synced: false } : null;
}

export async function findLyrics(track: Track, signal: AbortSignal): Promise<TrackLyrics | null> {
  const params = new URLSearchParams({ track_name: track.title, artist_name: track.artist });
  if (track.album) params.set("album_name", track.album);
  if (track.duration && track.duration > 0) params.set("duration", String(Math.round(track.duration)));

  const exact = await fetch(`https://lrclib.net/api/get?${params}`, { signal, headers: { Accept: "application/json" } });
  let exactLyrics: TrackLyrics | null = null;
  if (exact.ok) {
    exactLyrics = toLyrics(await exact.json() as LrclibRecord);
    if (exactLyrics?.wordSynced) return exactLyrics;
  } else if (exact.status !== 404) {
    throw new Error(`LRCLIB ${exact.status}`);
  }

  const search = new URLSearchParams({ track_name: track.title, artist_name: track.artist });
  const results = await fetch(`https://lrclib.net/api/search?${search}`, { signal, headers: { Accept: "application/json" } });
  if (!results.ok) throw new Error(`LRCLIB ${results.status}`);
  const records = await results.json() as LrclibRecord[];
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const title = normalize(track.title);
  const artist = normalize(track.artist);
  const matchingRecords = records
    .filter((item) => normalize(item.trackName ?? "") === title && normalize(item.artistName ?? "").includes(artist))
    .sort((a, b) => {
      const wordSyncPreference = Number(Boolean(b.lyricsfile?.match(/\bwords:\s*\r?\n\s+-\s+text:/))) - Number(Boolean(a.lyricsfile?.match(/\bwords:\s*\r?\n\s+-\s+text:/)));
      if (wordSyncPreference) return wordSyncPreference;
      const syncPreference = Number(Boolean(b.syncedLyrics?.trim() || b.lyricsfile?.match(/\bstart_ms:/))) - Number(Boolean(a.syncedLyrics?.trim() || a.lyricsfile?.match(/\bstart_ms:/)));
      if (syncPreference) return syncPreference;
      return Math.abs((a.duration ?? 0) - (track.duration ?? 0)) - Math.abs((b.duration ?? 0) - (track.duration ?? 0));
    });
  for (const record of matchingRecords) {
    const lyrics = toLyrics(record);
    if (lyrics?.synced) return lyrics;
  }
  return exactLyrics ?? (matchingRecords[0] ? toLyrics(matchingRecords[0]) : null);
}
