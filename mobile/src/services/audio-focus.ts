export interface AudioHolder { stop(): void }
let current: AudioHolder | undefined;

/** One app audio owner: acquiring audio stops the previous reading or conversation. */
export function claimAudio(holder: AudioHolder): () => void {
  const previous = current;
  current = holder;
  if (previous && previous !== holder) {
    try { previous.stop(); } catch { /* A failed old player must not prevent a new owner. */ }
  }
  return () => { if (current === holder) current = undefined; };
}
