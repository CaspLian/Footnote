import { throwIfAborted } from './abort-signal';

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, ms);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
  });
}

/** A presentation delay after actual work succeeds; errors are never masked by the demo pacing. */
export async function reviewWithMinimumDuration(run: () => Promise<void>, options: { signal: AbortSignal; minimumMs?: number; now?: () => number; wait?: typeof wait }) {
  const now = options.now ?? Date.now;
  throwIfAborted(options.signal);
  const start = now();
  await run();
  throwIfAborted(options.signal);
  const remaining = Math.max(0, (options.minimumMs ?? 6000) - (now() - start));
  if (remaining) await (options.wait ?? wait)(remaining, options.signal);
  throwIfAborted(options.signal);
}
