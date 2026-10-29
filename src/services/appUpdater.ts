import { isTauri } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

const DISMISSED_VERSION_KEY = "maehwa-melo:update-dismissed-version";
let checkInFlight: Promise<Update | null> | null = null;
let installing = false;
let lastCheckFailed = false;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function showUpdate(update: Update, manual = false): void {
  if (document.querySelector("[data-update-dialog]")) return;
  if (!manual && localStorage.getItem(DISMISSED_VERSION_KEY) === update.version) return;
  const notes = update.body?.trim() || "이번 버전의 변경 사항을 확인해 보세요.";
  const dialog = document.createElement("div");
  dialog.className = "update-dialog-backdrop";
  dialog.dataset.updateDialog = "";
  dialog.innerHTML = `<section class="update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-dialog-title"><div class="update-dialog-mark">M</div><span class="eyebrow">MAEHWA MELO UPDATE</span><h2 id="update-dialog-title">새 버전이 준비됐어요</h2><p class="update-dialog-version">MaeHwa Melo <strong>v${escapeHtml(update.version)}</strong></p><div class="update-dialog-notes">${escapeHtml(notes)}</div><div class="update-dialog-progress" data-update-progress hidden><span></span></div><p class="update-dialog-status" data-update-status aria-live="polite"></p><div class="update-dialog-actions"><button class="secondary-button" data-update-later>나중에</button><button class="primary-button" data-update-install>업데이트</button></div></section>`;
  document.body.append(dialog);
  dialog.querySelector<HTMLButtonElement>("[data-update-later]")?.addEventListener("click", () => {
    localStorage.setItem(DISMISSED_VERSION_KEY, update.version);
    dialog.remove();
  });
  dialog.querySelector<HTMLButtonElement>("[data-update-install]")?.addEventListener("click", () => { void installUpdate(update, dialog); });
}

async function installUpdate(update: Update, dialog: HTMLElement): Promise<void> {
  if (installing) return;
  installing = true;
  const button = dialog.querySelector<HTMLButtonElement>("[data-update-install]");
  const later = dialog.querySelector<HTMLButtonElement>("[data-update-later]");
  const status = dialog.querySelector<HTMLElement>("[data-update-status]");
  const progress = dialog.querySelector<HTMLElement>("[data-update-progress]");
  if (button) button.disabled = true;
  if (later) later.disabled = true;
  if (progress) progress.hidden = false;
  if (status) status.textContent = "업데이트를 다운로드하고 있어요…";
  let downloaded = 0;
  let total = 0;
  try {
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") total = event.data.contentLength ?? 0;
      if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
        if (total > 0 && progress) progress.style.setProperty("--update-progress", `${Math.min(100, downloaded / total * 100)}%`);
        if (status && total > 0) status.textContent = `업데이트 다운로드 중 · ${Math.floor(downloaded / total * 100)}%`;
      }
      if (event.event === "Finished" && status) status.textContent = "설치 후 앱을 다시 시작합니다…";
    });
    await relaunch();
  } catch (error) {
    installing = false;
    if (button) button.disabled = false;
    if (later) later.disabled = false;
    if (progress) progress.hidden = true;
    if (status) status.textContent = `업데이트를 설치하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function checkForUpdate(manual: boolean): Promise<void> {
  if (!isTauri()) return;
  if (checkInFlight) {
    const pending = await checkInFlight;
    if (pending && manual) showUpdate(pending, true);
    else if (!pending && manual && !lastCheckFailed) window.dispatchEvent(new CustomEvent("maehwa:notice", { detail: "현재 최신 버전을 사용하고 있습니다." }));
    return;
  }
  lastCheckFailed = false;
  checkInFlight = check().then((update) => {
    if (update) showUpdate(update, manual);
    else if (manual) window.dispatchEvent(new CustomEvent("maehwa:notice", { detail: "현재 최신 버전을 사용하고 있습니다." }));
    return update;
  }).catch((error: unknown) => {
    lastCheckFailed = true;
    if (manual) window.dispatchEvent(new CustomEvent("maehwa:notice", { detail: `업데이트를 확인하지 못했습니다: ${error instanceof Error ? error.message : String(error)}` }));
    return null;
  }).finally(() => { checkInFlight = null; });
  await checkInFlight;
}

export function initAppUpdater(): void {
  if (!isTauri()) return;
  void checkForUpdate(false);
  document.addEventListener("click", (event) => {
    if ((event.target as Element | null)?.closest("[data-check-updates]")) void checkForUpdate(true);
  });
}
