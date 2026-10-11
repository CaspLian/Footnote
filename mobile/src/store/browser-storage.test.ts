import assert from 'node:assert/strict';
import test from 'node:test';
import { createBrowserStorage, type BrowserStorageBackend } from './browser-storage';
import { createFootnoteStore } from './state';
import { createSampleCase } from '../domain/fixtures';
import { STORAGE_KEY } from './persistence';
import type { DocumentAttachment } from '../domain/types';

function backend() {
  const values = new Map<string, string>();
  const storage: BrowserStorageBackend = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
  return { storage, values };
}

test('browser metadata and durable attachment keys survive reload without persisting transient blob URLs', async () => {
  const b = backend();
  const storage = createBrowserStorage(() => b.storage);
  const first = createFootnoteStore(storage, { autoHydrate: false }); await first.getState().retryHydration();
  const attachment: DocumentAttachment = { id: 'browser-file', uri: 'footnote-attachment://browser-file', name: 'Statement.pdf', mimeType: 'application/pdf', kind: 'bill', origin: 'import', importedAt: new Date().toISOString() };
  const caseId = first.getState().addImportedCase(attachment);
  first.getState().updateCase(caseId, { provider: 'Browser provider', serviceDate: '2026-09-18' });
  first.getState().saveDraft(caseId, 'billing_correction', 'Edited in the browser', 'en');
  await first.getState().flushPersistence();
  const saved = b.values.get(STORAGE_KEY)!;
  assert.match(saved, /footnote-attachment:\/\/browser-file/); assert.doesNotMatch(saved, /blob:/);
  const reloaded = createFootnoteStore(storage, { autoHydrate: false }); await reloaded.getState().retryHydration();
  assert.equal(reloaded.getState().cases[0].attachments[0].uri, attachment.uri);
  assert.equal(reloaded.getState().drafts[0].body, 'Edited in the browser');
});

test('localStorage denial/quota errors preserve browser edits and recover through current snapshot retry', async () => {
  const b = backend(); let blocked = false;
  const storage = createBrowserStorage(() => {
    if (blocked) throw new Error('SecurityError');
    return b.storage;
  });
  const store = createFootnoteStore(storage, { autoHydrate: false }); await store.getState().retryHydration();
  const caseId = store.getState().addManualCase(); await store.getState().flushPersistence();
  const oldSave = b.values.get(STORAGE_KEY);
  blocked = true; store.getState().saveDraft(caseId, 'billing_correction', 'Keep these changes', 'en');
  await store.getState().flushPersistence(); assert.equal(store.getState().storageError, 'storage_unavailable');
  assert.equal(b.values.get(STORAGE_KEY), oldSave); assert.equal(store.getState().drafts[0].body, 'Keep these changes');
  blocked = false; await store.getState().retryPersistence(); assert.equal(store.getState().storageError, null);
  assert.match(b.values.get(STORAGE_KEY)!, /Keep these changes/);
});

test('hydration rebinds current sample URLs but preserves a removed EOB and imported document URI', async () => {
  const b = backend(); const storage = createBrowserStorage(() => b.storage);
  const initial = createFootnoteStore(storage, { autoHydrate: false }); await initial.getState().retryHydration();
  const sampleId = await initial.getState().loadSample(); await initial.getState().removeAttachment(sampleId, 'northline-eob');
  const imported: DocumentAttachment = { id: 'browser-file', uri: 'footnote-attachment://browser-file', name: 'Statement.pdf', mimeType: 'application/pdf', kind: 'bill', origin: 'import', importedAt: new Date().toISOString() };
  initial.getState().addAttachment(sampleId, imported); await initial.getState().flushPersistence();
  const reloaded = createFootnoteStore(storage, {
    autoHydrate: false,
    resolveSampleAttachments: async () => createSampleCase().attachments.map(a => ({ ...a, uri: `/assets/new-build/${a.id}.pdf` })),
  });
  await reloaded.getState().retryHydration();
  const attachments = reloaded.getState().cases[0].attachments;
  assert.equal(attachments.length, 2); assert.equal(attachments[0].uri, '/assets/new-build/northline-bill.pdf');
  assert.equal(attachments[1].uri, imported.uri); assert.equal(attachments.some(a => a.id === 'northline-eob'), false);
});

test('server-side store construction does not access browser storage', () => {
  const storage = createBrowserStorage(() => { throw new Error('No window during SSR'); });
  const store = createFootnoteStore(storage, { autoHydrate: false });
  assert.equal(store.getState().hydrated, false); assert.equal(store.getState().hydrationError, null);
});
