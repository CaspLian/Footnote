export interface ClipStatus { isLoaded?: boolean; playing?: boolean; didJustFinish?: boolean; error?: string | null }
export interface ClipPlayer {
  readonly isLoaded: boolean;
  readonly playing: boolean;
  addListener(event: 'playbackStatusUpdate', listener: (status: ClipStatus) => void): { remove(): void };
}

/** Wait for native confirmation, rather than treating play() as proof of playback. */
export function waitForAudio(player: ClipPlayer, phase: 'loaded' | 'playing', timeoutMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let subscription: { remove(): void } | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true; clearTimeout(timer); subscription?.remove(); signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    };
    const abort = () => { const error = new Error('Voice preview cancelled.'); error.name = 'AbortError'; finish(error); };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    subscription = player.addListener('playbackStatusUpdate', status => {
      if (status.error) finish(new Error('The voice preview could not be played. Try again.'));
      else if (phase === 'loaded' ? status.isLoaded : status.playing || status.didJustFinish) finish();
    });
    // Some players are ready before the listener is attached.
    if (phase === 'loaded' ? player.isLoaded : player.playing) finish();
    if (settled) subscription.remove();
    else timer = setTimeout(() => finish(new Error(phase === 'loaded' ? 'The voice preview could not be loaded. Check the connection and try again.' : 'Audio did not start. Check the emulator’s audio output and try again.')), timeoutMs);
  });
}
