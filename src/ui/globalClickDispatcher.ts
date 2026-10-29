export function bindGlobalClickDispatcher(
  app: HTMLElement,
  handleNowPlaying: (target: HTMLElement) => boolean,
  handleSpotifyAction: (target: HTMLElement) => boolean,
): void {
  app.onclick = (event) => {
    const target = event.target as HTMLElement;
    if (handleNowPlaying(target)) return;
    handleSpotifyAction(target);
  };
}
