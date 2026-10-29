import { invoke } from "@tauri-apps/api/core";
import type { Track } from "../../types";
import { esc, safeUrl } from "../../utils/format";

export interface MetadataCandidate {
  recordingMbid: string;
  releaseMbid: string;
  releaseGroupMbid?: string;
  artistMbid?: string;
  releaseArtistMbid?: string;
  title: string;
  artist: string;
  albumArtist: string;
  album: string;
  releaseDate?: string;
  score: number;
}

interface CoverArtPreview { dataUrl: string; mimeType: string; }
interface MetadataRepairState {
  track: Track;
  candidates: MetadataCandidate[];
  selected: MetadataCandidate | null;
  cover: CoverArtPreview | null;
  searching: boolean;
  loadingCover: boolean;
  applying: boolean;
  error: string;
  searchTitle: string;
  searchArtist: string;
  replaceCover: boolean;
}

interface MetadataRepairOptions {
  getCurrentTrack: () => Track | null;
  isTauriRuntime: () => boolean;
  render: () => void;
  showNotice: (message: string) => void;
  onApplied: (updated: Track) => void;
}

function metadataValue(label: string, value: string): string {
  return `<div class="metadata-repair-value"><span>${esc(label)}</span><b ${value ? `title="${esc(value)}"` : ""}>${esc(value || "없음")}</b></div>`;
}

function renderDialog(state: MetadataRepairState | null): string {
  if (!state) return "";
  const { track, selected } = state;
  const currentCover = track.artwork
    ? `<img src="${esc(safeUrl(track.artwork))}" alt="현재 앨범 커버">`
    : `<div class="metadata-cover-empty">커버 없음</div>`;
  let nextCover = `<div class="metadata-cover-empty">${selected ? "커버 없음" : "발매를 선택하세요"}</div>`;
  if (state.loadingCover) nextCover = `<div class="metadata-cover-empty">새 커버 조회 중…</div>`;
  else if (!state.replaceCover && track.artwork) nextCover = `<div class="metadata-cover-kept">기존 커버 유지</div>`;
  else if (state.cover) nextCover = `<img src="${esc(state.cover.dataUrl)}" alt="적용 예정 앨범 커버">`;
  else if (selected) nextCover = `<div class="metadata-cover-empty">${state.replaceCover ? "새 커버 없음" : "기존 커버 유지"}</div>`;

  const coverToggleMarkup = track.artwork
    ? `<div class="metadata-cover-toggle-wrap"><label class="metadata-cover-toggle"><input type="checkbox" data-metadata-cover-toggle ${state.replaceCover ? "checked" : ""}><span>새 커버로 교체</span></label></div>`
    : "";
  const candidateList = state.searching
    ? `<div class="metadata-repair-state">MusicBrainz에서 곡과 발매를 찾고 있습니다…</div>`
    : state.candidates.length
      ? `<div class="metadata-candidate-list">${state.candidates.map((candidate, index) => `<button class="metadata-candidate ${selected?.releaseMbid === candidate.releaseMbid ? "selected" : ""}" data-metadata-candidate="${index}"><span><b>${esc(candidate.album || "앨범명 없음")}</b><small>${esc(candidate.artist || "아티스트 정보 없음")} · ${esc(candidate.releaseDate ?? "발매일 정보 없음")}</small></span><i>${candidate.score}%</i></button>`).join("")}</div>`
      : `<div class="metadata-repair-state">${state.error ? esc(state.error) : "일치하는 발매를 찾지 못했습니다."}</div>`;
  const preview = selected ? `<section class="metadata-repair-preview"><div class="metadata-repair-section-heading"><b>변경 예정</b><small>적용 전 파일은 수정되지 않습니다</small></div><div class="metadata-repair-compare"><div class="metadata-repair-column"><strong>현재 파일</strong><div class="metadata-repair-cover">${currentCover}</div>${metadataValue("아티스트", track.artist)}${metadataValue("앨범 아티스트", track.albumArtist ?? "")}${metadataValue("곡명", track.title)}${metadataValue("앨범", track.album)}${metadataValue("발매일", track.releaseDate ?? (track.year ? String(track.year) : ""))}${metadataValue("발매 MBID", track.musicBrainzReleaseId ?? "")}${metadataValue("녹음 MBID", track.musicBrainzRecordingId ?? "")}${metadataValue("아티스트 MBID", track.musicBrainzArtistId ?? "")}${metadataValue("발매 아티스트 MBID", track.musicBrainzReleaseArtistId ?? "")}${metadataValue("발매 그룹 MBID", track.musicBrainzReleaseGroupId ?? "")}</div><div class="metadata-repair-column proposed"><strong>MusicBrainz</strong><div class="metadata-repair-cover">${nextCover}</div>${coverToggleMarkup}${metadataValue("아티스트", selected.artist)}${metadataValue("앨범 아티스트", selected.albumArtist)}${metadataValue("곡명", selected.title)}${metadataValue("앨범", selected.album)}${metadataValue("발매일", selected.releaseDate ?? "")}${metadataValue("발매 MBID", selected.releaseMbid)}${metadataValue("녹음 MBID", selected.recordingMbid)}${metadataValue("아티스트 MBID", selected.artistMbid ?? "")}${metadataValue("발매 아티스트 MBID", selected.releaseArtistMbid ?? "")}${metadataValue("발매 그룹 MBID", selected.releaseGroupMbid ?? "")}</div></div></section>` : "";
  const searchBar = `<div class="metadata-search-bar"><div class="metadata-search-fields"><input class="metadata-search-input" data-metadata-search-title type="text" placeholder="곡명" value="${esc(state.searchTitle)}" ${state.searching || state.applying ? "disabled" : ""} aria-label="검색할 곡명"><input class="metadata-search-input" data-metadata-search-artist type="text" placeholder="아티스트 (비워도 됨)" value="${esc(state.searchArtist)}" ${state.searching || state.applying ? "disabled" : ""} aria-label="검색할 아티스트"></div><button class="metadata-search-button" data-metadata-search ${state.searching || state.applying ? "disabled" : ""} aria-label="재검색">${state.searching ? "검색 중…" : "검색"}</button></div>`;
  return `<div class="metadata-repair-backdrop" data-metadata-backdrop><section class="metadata-repair-modal" role="dialog" aria-modal="true" aria-labelledby="metadata-repair-title"><header class="metadata-repair-heading"><div><span class="eyebrow">LOCAL FILE TAGS</span><h2 id="metadata-repair-title">메타데이터 보완</h2><p>${esc(track.title)} · ${esc(track.artist || "아티스트 없음")}</p></div><button class="metadata-repair-close" data-metadata-close aria-label="닫기">×</button></header>${searchBar}<section class="metadata-repair-search"><div class="metadata-repair-section-heading"><b>MusicBrainz 조회 결과</b><small>발매를 선택해 적용할 내용을 확인하세요</small></div>${candidateList}</section>${preview}${state.error && selected ? `<p class="metadata-repair-error">${esc(state.error)}</p>` : ""}<footer class="metadata-repair-actions"><button class="secondary-button" data-metadata-close ${state.applying ? "disabled" : ""}>취소</button><button class="primary-button" data-metadata-apply ${!selected || state.applying ? "disabled" : ""}>${state.applying ? "파일에 적용 중…" : "변경 사항 적용"}</button></footer></section></div>`;
}

function cleanSearchTitle(rawTitle: string, artistHint?: string): string {
  let title = rawTitle.trim();
  if (artistHint?.trim()) {
    const cleanHint = artistHint.trim().toLowerCase();
    for (const sep of [" - ", " – ", " — ", " _ ", ": "]) {
      const parts = title.split(sep);
      if (parts.length >= 2 && parts[0].trim().toLowerCase() === cleanHint) { title = parts.slice(1).join(sep).trim(); break; }
    }
  }
  let cleaned = title.replace(/[【〈《『「][^】〉》』」]*[】〉》』」]/g, " ");
  cleaned = cleaned.replace(/[\(\[\{][^\)\]\}]*(?:가사|lyrics?|audio|official|video|mv|m\/v|교차편집|자막|응원법|mr제거|라이브|live)[^\)\]\}]*[\)\]\}]/gi, " ");
  const trailingNoise = /\s*(?:[-_~/]\s*)?(?:official\s*(?:video|audio|music\s*video|mv)?|music\s*video|mv|m\/v|lyrics?|audio|visualizer|live|가사|뮤비|교차편집|음원)\s*$/i;
  while (trailingNoise.test(cleaned)) cleaned = cleaned.replace(trailingNoise, "").trim();
  cleaned = cleaned.replace(/^['"“‘](.*)['"”’]$/, "$1").trim();
  return cleaned.replace(/\s+/g, " ").trim() || rawTitle.trim();
}

function cleanSearchArtist(artist: string): string {
  let cleaned = artist.trim().replace(/\s+(?:feat|ft|featuring)\.?\s+.*$/i, "");
  const match = cleaned.match(/^([^(]+)\(([^)]+)\)$/);
  if (match) {
    const before = match[1].trim();
    if (before.length >= 2) return before;
    const inner = match[2].trim();
    if (inner.length >= 2) return inner;
  }
  return cleaned;
}

export function createMetadataRepair(options: MetadataRepairOptions) {
  let state: MetadataRepairState | null = null;
  const render = options.render;

  async function search(currentState: MetadataRepairState): Promise<void> {
    currentState.searching = true;
    currentState.candidates = [];
    currentState.selected = null;
    currentState.cover = null;
    currentState.error = "";
    render();
    try {
      const candidates = await invoke<MetadataCandidate[]>("search_musicbrainz_metadata", { title: currentState.searchTitle, artist: currentState.searchArtist, album: currentState.track.album });
      if (state !== currentState) return;
      currentState.candidates = candidates;
      if (!candidates.length) currentState.error = "일치하는 발매를 찾지 못했습니다. 위 검색어를 수정해 다시 시도해 보세요.";
    } catch (error) {
      if (state !== currentState) return;
      currentState.error = error instanceof Error ? error.message : String(error);
    } finally {
      if (state === currentState) { currentState.searching = false; render(); }
    }
  }

  async function selectCandidate(index: number): Promise<void> {
    const currentState = state;
    const candidate = currentState?.candidates[index];
    if (!currentState || !candidate) return;
    currentState.selected = candidate;
    currentState.cover = null;
    currentState.error = "";
    currentState.loadingCover = true;
    render();
    requestAnimationFrame(() => document.querySelector<HTMLElement>(".metadata-repair-preview")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    try {
      currentState.cover = await invoke<CoverArtPreview>("fetch_cover_art_preview", { releaseMbid: candidate.releaseMbid });
    } catch (error) {
      if (state !== currentState || currentState.selected?.releaseMbid !== candidate.releaseMbid) return;
      currentState.error = error instanceof Error ? error.message : String(error);
    } finally {
      if (state === currentState && currentState.selected?.releaseMbid === candidate.releaseMbid) { currentState.loadingCover = false; render(); }
    }
  }

  async function apply(): Promise<void> {
    const currentState = state;
    const candidate = currentState?.selected;
    if (!currentState || !candidate || currentState.applying) return;
    currentState.applying = true;
    currentState.error = "";
    render();
    try {
      const shouldApplyCover = currentState.replaceCover && !!currentState.cover;
      const updated = await invoke<Track>("apply_local_metadata", { update: {
        path: currentState.track.localPath ?? "",
        title: candidate.title,
        artist: candidate.artist,
        albumArtist: candidate.albumArtist,
        album: candidate.album,
        releaseDate: candidate.releaseDate ?? null,
        releaseMbid: candidate.releaseMbid,
        recordingMbid: candidate.recordingMbid,
        artistMbid: candidate.artistMbid ?? null,
        releaseArtistMbid: candidate.releaseArtistMbid ?? null,
        releaseGroupMbid: candidate.releaseGroupMbid ?? null,
        coverData: shouldApplyCover ? currentState.cover?.dataUrl ?? null : null,
        coverMime: shouldApplyCover ? currentState.cover?.mimeType ?? null : null,
      } });
      options.onApplied(updated);
      state = null;
      render();
      options.showNotice("선택한 메타데이터를 파일에 적용했습니다.");
    } catch (error) {
      if (state === currentState) { currentState.applying = false; currentState.error = error instanceof Error ? error.message : String(error); render(); }
    }
  }

  async function open(): Promise<void> {
    const track = options.getCurrentTrack();
    if (!track || track.source !== "local" || !track.localPath || track.localPath.startsWith("blob:")) {
      options.showNotice("보완할 로컬 곡을 먼저 재생해 주세요.");
      return;
    }
    if (!options.isTauriRuntime()) { options.showNotice("메타데이터 보완은 설치된 Windows 앱에서 사용할 수 있습니다."); return; }
    let title = track.title;
    let artist = track.artist;
    for (const sep of [" – ", " — ", " - "]) {
      const index = title.indexOf(sep);
      if (index > 0) {
        const leftPart = title.slice(0, index).trim();
        const rightPart = title.slice(index + sep.length).trim();
        if (!artist.trim()) { artist = leftPart; title = rightPart; break; }
        if (leftPart.toLowerCase() === artist.toLowerCase() || leftPart.toLowerCase().includes(artist.toLowerCase())) { title = rightPart; break; }
      }
    }
    const searchArtist = cleanSearchArtist(artist);
    state = { track: { ...track }, candidates: [], selected: null, cover: null, searching: true, loadingCover: false, applying: false, error: "", searchTitle: cleanSearchTitle(title, searchArtist), searchArtist, replaceCover: !track.artwork };
    render();
    await search(state);
  }

  function close(): void {
    if (state?.applying) return;
    state = null;
    render();
  }

  function bindEvents(root: ParentNode): void {
    root.querySelector<HTMLElement>("[data-metadata-repair]")?.addEventListener("click", () => void open());
    root.querySelectorAll<HTMLElement>("[data-metadata-close]").forEach((button) => button.addEventListener("click", close));
    root.querySelector<HTMLElement>("[data-metadata-backdrop]")?.addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
    root.querySelectorAll<HTMLElement>("[data-metadata-candidate]").forEach((button) => button.addEventListener("click", () => void selectCandidate(Number(button.dataset.metadataCandidate))));
    root.querySelector<HTMLElement>("[data-metadata-apply]")?.addEventListener("click", () => void apply());
    root.querySelector<HTMLElement>(".metadata-repair-modal")?.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
    root.querySelector<HTMLInputElement>("[data-metadata-search-title]")?.addEventListener("input", (event) => { if (state) state.searchTitle = (event.target as HTMLInputElement).value; });
    root.querySelector<HTMLInputElement>("[data-metadata-search-artist]")?.addEventListener("input", (event) => { if (state) state.searchArtist = (event.target as HTMLInputElement).value; });
    root.querySelector<HTMLInputElement>("[data-metadata-cover-toggle]")?.addEventListener("change", (event) => {
      if (state) { state.replaceCover = (event.target as HTMLInputElement).checked; render(); }
    });
    const doManualSearch = () => { if (state && !state.searching && !state.applying && state.searchTitle.trim()) void search(state); };
    root.querySelector<HTMLElement>("[data-metadata-search]")?.addEventListener("click", doManualSearch);
    root.querySelector<HTMLInputElement>("[data-metadata-search-title]")?.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); doManualSearch(); } });
    root.querySelector<HTMLInputElement>("[data-metadata-search-artist]")?.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); doManualSearch(); } });
  }

  return { open, bindEvents, close, isApplying: () => Boolean(state?.applying), renderDialog: () => renderDialog(state) };
}
