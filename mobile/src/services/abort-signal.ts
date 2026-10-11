/** React Native's abort-controller lacks throwIfAborted() and may lack reason. */
export function throwIfAborted(signal?: { readonly aborted: boolean; readonly reason?: unknown }): void {
  if (!signal?.aborted) return;
  if (signal.reason !== undefined) throw signal.reason;
  const error = new Error('The request was cancelled.');
  error.name = 'AbortError';
  throw error;
}
