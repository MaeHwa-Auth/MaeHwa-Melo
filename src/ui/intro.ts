interface IntroOptions {
  app: HTMLElement;
  refreshScrollbars: (root: HTMLElement) => void;
}

export function createIntroController(options: IntroOptions) {
  const startedAt = Date.now();
  const minimumDuration = 2400;
  let dismissed = false;

  function setStatus(text: string): void {
    const element = document.getElementById("intro-status");
    if (element) element.textContent = text;
  }

  function dismiss(): void {
    if (dismissed) return;
    const remaining = Math.max(0, minimumDuration - (Date.now() - startedAt));
    if (remaining > 0) { window.setTimeout(dismiss, remaining); return; }
    dismissed = true;
    setStatus("준비 완료");
    const intro = document.getElementById("intro-screen");
    if (!intro) return;
    intro.classList.add("intro-done");
    window.setTimeout(() => {
      intro.classList.add("intro-hidden");
      document.body.classList.remove("has-intro");
      document.body.classList.add("intro-finished");
      options.refreshScrollbars(options.app);
    }, 600);
  }

  return { setStatus, dismiss };
}
