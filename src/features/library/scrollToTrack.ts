export function scrollToTrack(app: HTMLElement, trackId: string | undefined): void {
  window.requestAnimationFrame(() => {
    const mainContent = app.querySelector<HTMLElement>(".main-content");
    if (!mainContent || !trackId) return;
    const targetRow = mainContent.querySelector<HTMLElement>(`.track-row[data-track="${CSS.escape(trackId)}"]`)
      ?? mainContent.querySelector<HTMLElement>(".track-row.is-current");
    if (!targetRow) return;
    const containerRect = mainContent.getBoundingClientRect();
    const targetRect = targetRow.getBoundingClientRect();
    const centeredTop = mainContent.scrollTop + targetRect.top - containerRect.top - (mainContent.clientHeight - targetRow.offsetHeight) / 2;
    mainContent.scrollTo({ top: Math.max(0, centeredTop), behavior: "smooth" });
  });
}
