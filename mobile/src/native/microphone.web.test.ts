import test from 'node:test';
import assert from 'node:assert/strict';
import { requestMicrophone } from './microphone.web';

async function withBrowser(secure: boolean, mediaDevices: unknown, run: () => Promise<void>) {
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const oldSecure = Object.getOwnPropertyDescriptor(globalThis, 'isSecureContext');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices } });
  Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: secure });
  try { await run(); }
  finally {
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
    if (oldSecure) Object.defineProperty(globalThis, 'isSecureContext', oldSecure); else Reflect.deleteProperty(globalThis, 'isSecureContext');
  }
}

test('web microphone permission checks release every temporary track before live startup', async () => {
  let stopped = 0;
  await withBrowser(true, { getUserMedia: async (constraints: unknown) => {
    assert.deepEqual(constraints, { audio: true });
    return { getTracks: () => [{ stop: () => stopped++ }, { stop: () => stopped++ }] };
  } }, async () => { assert.equal(await requestMicrophone(), 'granted'); });
  assert.equal(stopped, 2);
});

test('insecure pages never request a microphone; a missing device and denial have distinct messages', async () => {
  let requests = 0;
  await withBrowser(false, { getUserMedia: async () => { requests++; } }, async () => { assert.equal(await requestMicrophone(), 'insecure'); });
  assert.equal(requests, 0);
  await withBrowser(true, undefined, async () => { assert.equal(await requestMicrophone(), 'insecure'); });
  for (const [name, expected] of [['NotFoundError', 'no_device'], ['NotAllowedError', 'denied']] as const) {
    await withBrowser(true, { getUserMedia: async () => { throw Object.assign(new Error('synthetic refusal'), { name }); } }, async () => { assert.equal(await requestMicrophone(), expected); });
  }
});
