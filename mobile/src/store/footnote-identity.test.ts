import assert from 'node:assert/strict';
import test from 'node:test';
import { createFootnoteStore, type LocalStorage } from './state';
import { STORAGE_KEY } from './persistence';

test('fresh Footnote hydration only reads its own workspace key', async () => {
  const read: string[] = [];
  const storage: LocalStorage = { getItem: key => { read.push(key); return null; }, setItem: () => {}, removeItem: () => {} };
  const store = createFootnoteStore(storage, { autoHydrate: false });
  await store.getState().retryHydration();
  assert.deepEqual(read, [STORAGE_KEY]);
  assert.equal(store.getState().cases.length, 0);
  assert.equal(store.getState().profiles.length, 0);
  assert.equal(store.getState().hydrationError, null);
});

test('explicit empty recovery clears the Footnote key', async () => {
  const removed: string[] = [];
  const storage: LocalStorage = { getItem: () => null, setItem: () => {}, removeItem: key => { removed.push(key); } };
  const store = createFootnoteStore(storage, { autoHydrate: false });
  await store.getState().retryHydration();
  await store.getState().recoverEmpty();
  assert.deepEqual(removed, [STORAGE_KEY]);
  assert.equal(store.getState().cases.length, 0);
});
