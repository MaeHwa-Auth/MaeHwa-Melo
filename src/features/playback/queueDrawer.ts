import type { Track } from "../../types";
import { esc } from "../../utils/format";
import { artistLinksMarkup } from "../library/trackPresentation";

export type QueueDrawerTab = "queue" | "recent";

interface QueueDrawerOptions {
  tab: QueueDrawerTab;
  current: Track | null;
  playlistName: string;
  upcoming: Track[];
  recent: Track[];
  artMarkup: (track: Track | null, size?: "hero" | "mini") => string;
  artistLabel: (track: Pick<Track, "artist" | "source"> | null | undefined) => string;
}

function trackRow(track: Track, artistLabel: QueueDrawerOptions["artistLabel"], artMarkup: QueueDrawerOptions["artMarkup"], kind: "queue" | "recent"): string {
  return `<button class="queue-track" data-queue-play="${esc(track.id)}" data-queue-kind="${kind}">${artMarkup(track, "mini")}<span><b>${esc(track.title)}</b><small>${artistLinksMarkup(track)}</small></span></button>`;
}

export function renderQueueDrawer(options: QueueDrawerOptions): string {
  const { tab, current, playlistName, upcoming, recent, artMarkup, artistLabel } = options;
  const content = tab === "queue"
    ? `<section class="queue-section"><h3>지금 재생 중</h3>${current ? `<div class="queue-current">${artMarkup(current, "mini")}<span><b>${esc(current.title)}</b><small>${artistLinksMarkup(current)}</small></span></div>` : `<p class="queue-empty">재생 중인 곡이 없습니다.</p>`}</section><section class="queue-section"><h3>다음 재생${playlistName ? ` ${esc(playlistName)}` : ""}</h3>${upcoming.length ? upcoming.map((track) => trackRow(track, artistLabel, artMarkup, "queue")).join("") : `<p class="queue-empty">다음 재생 항목이 없습니다.</p>`}</section>`
    : `<section class="queue-section queue-recent-list"><h3>최근 재생한 항목</h3>${recent.length ? recent.map((track) => trackRow(track, artistLabel, artMarkup, "recent")).join("") : `<p class="queue-empty">최근 재생한 곡이 없습니다.</p>`}</section>`;

  return `<aside class="now-playing-panel queue-drawer" aria-label="재생 대기열"><div class="queue-panel-heading"><strong>재생 대기열</strong><button type="button" class="queue-close" data-queue-close aria-label="지금 재생 화면으로 돌아가기" title="지금 재생 화면으로 돌아가기">×</button></div><header class="queue-heading"><div role="tablist" aria-label="대기열 보기"><button type="button" role="tab" data-queue-tab="queue" aria-selected="${tab === "queue"}">재생목록</button><button type="button" role="tab" data-queue-tab="recent" aria-selected="${tab === "recent"}">최근 재생한 항목</button><span class="queue-tab-indicator" aria-hidden="true"></span></div></header><div class="queue-content">${content}</div></aside>`;
}
