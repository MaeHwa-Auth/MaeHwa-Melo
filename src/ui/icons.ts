export function icon(name: string): string {
  const paths: Record<string, string> = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    library: '<path d="M4 5h16M4 10h16M4 15h16M4 20h16"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    heart: '<path d="M20.8 8.8c0 5.4-8.8 10.2-8.8 10.2S3.2 14.2 3.2 8.8A4.3 4.3 0 0 1 12 6.7a4.3 4.3 0 0 1 8.8 2.1Z"/>',
    'heart-filled': '<path fill="currentColor" stroke="none" d="M20.8 8.8c0 5.4-8.8 10.2-8.8 10.2S3.2 14.2 3.2 8.8A4.3 4.3 0 0 1 12 6.7a4.3 4.3 0 0 1 8.8 2.1Z"/>',
    settings: '<path d="M9.6 2.8h4.8l.6 2.2a7.6 7.6 0 0 1 1.7 1l2.1-.8 2.4 4.1-1.7 1.5c.1.6.1 1.3 0 1.9l1.7 1.5-2.4 4.1-2.1-.8a7.6 7.6 0 0 1-1.7 1l-.6 2.2H9.6L9 18.5a7.6 7.6 0 0 1-1.7-1l-2.1.8-2.4-4.1 1.7-1.5a7.6 7.6 0 0 1 0-1.9L2.8 9.3l2.4-4.1 2.1.8a7.6 7.6 0 0 1 1.7-1l.6-2.2H9.6z"/><circle cx="12" cy="12" r="3"/>',
    minimize: '<path d="M5 12h14"/>', maximize: '<rect x="5" y="5" width="14" height="14" rx="1"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>',
    spotify: '<circle cx="12" cy="12" r="9"/><path d="M7 10c3.7-1 7.5-.6 10.5 1M8 13c2.9-.7 6-.3 8.5 1M9 16c2-.4 4.1-.1 5.8.8"/>',
    check: '<path d="m5 12 4 4L19 6"/>', chevron: '<path d="m9 18 6-6-6-6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
    sort: '<path d="M4 6h10M4 12h7M4 18h4M18 4v16m0 0-3-3m3 3 3-3"/>',
    shuffle: '<path d="m16 3 5 4-5 4M3 7h3c5 0 7 10 12 10h3M16 13l5 4-5 4M3 17h3c1.8 0 3.2-1.4 4.4-3"/>',
    previous: '<path d="M6 5v14M19 6l-9 6 9 6z"/>', next: '<path d="M18 5v14M5 6l9 6-9 6z"/>',
    play: '<path fill="currentColor" stroke="none" d="m8 5 11 7-11 7z"/>', pause: '<path d="M8 5h3v14H8zM15 5h3v14h-3z"/>',
    repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
    'repeat-one': '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3M12 10v5m-1-4 1-1 1 1"/>',
    'history-back': '<path d="m14 18-6-6 6-6"/>',
    'history-forward': '<path d="m10 18 6-6-6-6"/>',
    volume: '<path d="M4 10v4h4l5 4V6l-5 4zM17 9a5 5 0 0 1 0 6M19 5a10 10 0 0 1 0 14"/>',
    muted: '<path d="M4 10v4h4l5 4V6l-5 4zM17 9l5 6m0-6-5 6"/>',
    queue: '<path d="M4 6h16M4 12h16M4 18h10"/>', album: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="4"/>',
    lyrics: '<path d="M4 5h16M4 10h16M4 15h10M4 20h7"/>',
    folder: '<path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16"/>', expand: '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M3 8l6-5m12 5-6-5M3 16l6 5m12-5-6 5"/>', share: '<path d="M12 16V3m0 0L7 8m5-5 5 5M5 13v7h14v-7"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.5-3"/>'
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] ?? paths.music}</svg>`;
}
