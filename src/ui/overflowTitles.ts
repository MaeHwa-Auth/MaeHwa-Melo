export function markOverflowingAlbumTitles(root: ParentNode): void {
  const overflowDistance = (content: HTMLElement | null, viewport: HTMLElement | null): number => {
    if (!content || !viewport) return 0;
    return Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  };
  root.querySelectorAll<HTMLElement>(".album-card, .track-row").forEach((card) => {
    const title = card.querySelector<HTMLElement>("[data-marquee-title]");
    const viewport = title?.parentElement ?? null;
    const overflow = overflowDistance(title, viewport);
    card.classList.toggle("has-overflowing-title", overflow > 1);
    if (overflow > 1) {
      title!.style.setProperty("--album-title-offset", `-${overflow}px`);
      title!.style.setProperty("--album-title-duration", `${Math.max(1.2, overflow / 100)}s`);
    }
  });
  root.querySelectorAll<HTMLElement>(".track-row").forEach((row) => {
    const label = row.querySelector<HTMLElement>("[data-album-marquee]");
    const viewport = label?.parentElement ?? null;
    const overflow = overflowDistance(label, viewport);
    row.classList.toggle("has-overflowing-album", overflow > 1);
    if (overflow > 1) {
      label!.style.setProperty("--album-title-offset", `-${overflow}px`);
      label!.style.setProperty("--album-title-duration", `${Math.max(1.2, overflow / 100)}s`);
    }
  });
  root.querySelectorAll<HTMLElement>(".now-playing-panel").forEach((panel) => {
    panel.querySelectorAll<HTMLElement>("[data-panel-marquee-title]").forEach((viewport) => {
      const title = viewport.firstElementChild as HTMLElement | null;
      const overflow = overflowDistance(title, viewport);
      viewport.classList.toggle("has-overflowing-panel-title", overflow > 1);
      if (title && overflow > 1) {
        title.style.setProperty("--panel-title-offset", `-${overflow}px`);
        title.style.setProperty("--panel-title-duration", `${Math.max(2.5, overflow / 45)}s`);
      } else if (title) {
        title.style.removeProperty("--panel-title-offset");
        title.style.removeProperty("--panel-title-duration");
      }
    });
    const viewport = panel.querySelector<HTMLElement>("[data-now-playing-artists]");
    const artists = viewport?.firstElementChild as HTMLElement | null;
    const overflow = overflowDistance(artists, viewport);
    panel.classList.toggle("has-overflowing-artists", overflow > 1);
    if (artists && overflow > 1) {
      artists.style.setProperty("--artist-marquee-offset", `-${overflow}px`);
      artists.style.setProperty("--artist-marquee-duration", `${Math.max(2.5, overflow / 45)}s`);
    } else if (artists) {
      artists.style.removeProperty("--artist-marquee-offset");
      artists.style.removeProperty("--artist-marquee-duration");
    }
  });
  markNowMetaArtists(root);
}

export function markNowMetaArtists(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(".now-meta").forEach((meta) => {
    const viewport = meta.querySelector<HTMLElement>("[data-now-meta-artists]");
    const artists = viewport?.firstElementChild as HTMLElement | null;
    const overflow = viewport && artists
      ? Math.max(0, viewport.scrollWidth - viewport.clientWidth)
      : 0;
    meta.classList.toggle("has-overflowing-artists", overflow > 1);
    if (artists && overflow > 1) {
      artists.style.setProperty("--artist-marquee-offset", `-${overflow}px`);
      artists.style.setProperty("--artist-marquee-duration", `${Math.max(2.5, overflow / 45)}s`);
    } else if (artists) {
      artists.style.removeProperty("--artist-marquee-offset");
      artists.style.removeProperty("--artist-marquee-duration");
    }
  });
}
