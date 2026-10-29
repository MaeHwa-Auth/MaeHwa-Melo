export function createNoticeController(): { show: (message: string) => void } {
  let timer: number | undefined;

  function show(message: string): void {
    let element = document.querySelector<HTMLDivElement>(".toast");
    if (!element) { element = document.createElement("div"); element.className = "toast"; document.body.append(element); }
    element.textContent = message;
    element.classList.add("visible");
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => element?.classList.remove("visible"), 3500);
  }

  return { show };
}
