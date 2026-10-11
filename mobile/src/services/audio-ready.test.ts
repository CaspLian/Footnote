import assert from 'node:assert/strict';
import test from 'node:test';
import { waitForAudio, type ClipStatus } from './audio-ready';

function player(loaded = false) {
  const listeners = new Set<(status: ClipStatus) => void>();
  return {
    isLoaded: loaded, playing: false,
    addListener(_event: string, listener: (status: ClipStatus) => void) { listeners.add(listener); return { remove: () => { listeners.delete(listener); } }; },
    emit(status: ClipStatus) { for (const listener of [...listeners]) listener(status); },
    get subscriptions() { return listeners.size; },
  };
}
test('loading confirmation does not count as started playback', async () => {
  const clip = player();
  const ready = waitForAudio(clip, 'loaded', 1000); clip.emit({ isLoaded: true }); await ready;
  const playing = waitForAudio(clip, 'playing', 1000);
  clip.emit({ isLoaded: true, playing: false }); assert.equal(clip.subscriptions, 1);
  clip.emit({ playing: true }); await playing; assert.equal(clip.subscriptions, 0);
});
test('native decoder or network errors immediately reject and remove the listener', async () => {
  const clip = player(); const ready = waitForAudio(clip, 'loaded', 1000);
  clip.emit({ error: 'native failure with private URL' });
  await assert.rejects(ready, /could not be played/); assert.equal(clip.subscriptions, 0);
});
test('cancelling an in-flight preview removes its listener and rejects before playback', async () => {
  const clip = player(); const abort = new AbortController();
  const ready = waitForAudio(clip, 'loaded', 1000, abort.signal); abort.abort();
  await assert.rejects(ready, { name: 'AbortError' }); assert.equal(clip.subscriptions, 0);
});
test('a player that never starts times out, and an already-loaded player resolves immediately', async () => {
  const clip = player(true); await waitForAudio(clip, 'loaded', 10);
  await assert.rejects(waitForAudio(clip, 'playing', 10), /Audio did not start/);
  assert.equal(clip.subscriptions, 0);
});
