import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { throwIfAborted } from './abort-signal';

const require = createRequire(import.meta.url);
// This is the package installed by React Native's setUpXHR.js on Android, rather than Node's newer API.
const { AbortController: NativeAbortController } = require('abort-controller');

test('the Android abort implementation works without the newer method', () => {
  const controller = new NativeAbortController();
  assert.equal(typeof controller.signal.throwIfAborted, 'undefined');
  assert.doesNotThrow(() => throwIfAborted(controller.signal));
  controller.abort();
  assert.throws(() => throwIfAborted(controller.signal), { name: 'AbortError' });
});
test('browser cancellation preserves its supplied reason and missing signals remain valid', () => {
  const controller = new AbortController(); const reason = new Error('Stopped by the user');
  assert.doesNotThrow(() => throwIfAborted());
  controller.abort(reason);
  assert.throws(() => throwIfAborted(controller.signal), error => error === reason);
});
