export function replaceWithMarkup(element: Element | null, markup: string): void {
  if (!element) return;
  const template = document.createElement("template");
  template.innerHTML = markup;
  const replacement = template.content.firstElementChild;
  if (replacement) element.replaceWith(replacement);
}
