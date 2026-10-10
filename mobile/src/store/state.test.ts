import assert from 'node:assert/strict';
import test from 'node:test';
import { createUnfoldStore, type LocalStorage } from './state';
import { parseSnapshot, STORAGE_KEY } from './persistence';
import { documentService } from '../services/local-services';
import type { DocumentAttachment, ReviewResult } from '../domain/types';

function memoryStorage() {
  const records = new Map<string, string>();
  const behavior = { failRead: false, failWrite: false };
  const storage: LocalStorage = {
    async getItem(key) { if (behavior.failRead) throw new Error('read failed'); return records.get(key) ?? null; },
    async setItem(key, value) { if (behavior.failWrite) throw new Error('write failed'); records.set(key, value); },
    async removeItem(key) { records.delete(key); },
  };
  return { records, behavior, storage };
}
let sequence = 0;
const clock = () => '2026-10-09T17:00:00.000Z';
const id = (prefix: string) => `${prefix}-${++sequence}`;
const imported: DocumentAttachment = { id: 'import', uri: 'file:///app/unfold/a.pdf', name: 'Bill.pdf', mimeType: 'application/pdf', kind: 'bill', origin: 'import', importedAt: clock() };

async function ready(storage: LocalStorage, options: Parameters<typeof createUnfoldStore>[1] = {}) {
  const store = createUnfoldStore(storage, { now: clock, id, autoHydrate: false, ...options });
  await store.getState().retryHydration(); return store;
}

test('draft autosave, language, icon preferences and timelines recover after restart', async () => {
  const m = memoryStorage(); const store = await ready(m.storage);
  const caseId = await store.getState().loadSample(); await store.getState().verifyCase(caseId);
  const draftId = await store.getState().prepareDraft(caseId, 'billing_correction');
  store.getState().saveDraft(caseId, 'billing_correction', 'My edited request', 'en');
  store.getState().setLocale('es'); store.getState().setIconPreferences({ iconWeight: 'bold', iconSize: 28, duotoneOpacity: 0.35 });
  await store.getState().prepareDraft(caseId, 'billing_correction');
  store.getState().setFollowUp(caseId, '2026-10-16'); await store.getState().flushPersistence();
  const recovered = await ready(m.storage);
  assert.equal(recovered.getState().drafts.find(d => d.id === draftId)?.body, 'My edited request');
  assert.equal(recovered.getState().drafts.length, 2); assert.equal(recovered.getState().locale, 'es');
  assert.equal(recovered.getState().iconWeight, 'bold'); assert.equal(recovered.getState().cases[0].followUpDate, '2026-10-16');
  assert.equal(recovered.getState().events.filter(e => e.kind === 'verified').length, 1);
});

test('submission is explicit and idempotent, with distinct events only for an edited new revision', async () => {
  const m = memoryStorage(); const store = await ready(m.storage); const caseId = await store.getState().loadSample();
  const draftId = await store.getState().prepareDraft(caseId, 'billing_correction');
  assert.equal(store.getState().cases[0].status, 'action_prepared');
  assert.equal(store.getState().events.some(e => e.kind === 'submitted'), false);
  store.getState().markSubmitted(draftId); store.getState().markSubmitted(draftId);
  assert.equal(store.getState().events.filter(e => e.kind === 'submitted').length, 1);
  store.getState().saveDraft(caseId, 'billing_correction', 'A revised request', 'en');
  assert.equal(store.getState().drafts[0].revision, 2); assert.equal(store.getState().drafts[0].submittedAt, undefined);
  store.getState().markSubmitted(draftId); store.getState().markSubmitted(draftId);
  assert.equal(store.getState().events.filter(e => e.kind === 'submitted').length, 2);
});

test('a write failure retains the live draft and retry saves the latest snapshot without rehydrating', async () => {
  const m = memoryStorage(); const store = await ready(m.storage); const caseId = store.getState().addManualCase();
  await store.getState().flushPersistence(); m.behavior.failWrite = true;
  store.getState().saveDraft(caseId, 'billing_correction', 'Draft survives a full disk', 'en');
  await store.getState().flushPersistence(); assert.equal(store.getState().storageError, 'storage_unavailable');
  assert.equal(store.getState().drafts[0].body, 'Draft survives a full disk');
  m.behavior.failWrite = false; await store.getState().retryPersistence();
  assert.equal(store.getState().storageError, null);
  assert.equal(parseSnapshot(m.records.get(STORAGE_KEY)!).drafts[0].body, 'Draft survives a full disk');
});

test('read failure preserves stored data until retry, and corruption needs an explicit recovery choice', async () => {
  const m = memoryStorage(); const initial = await ready(m.storage); await initial.getState().loadSample(); await initial.getState().flushPersistence();
  const saved = m.records.get(STORAGE_KEY)!; m.behavior.failRead = true;
  const failed = await ready(m.storage); assert.equal(failed.getState().hydrationError, 'saved_data_unreadable');
  assert.equal(m.records.get(STORAGE_KEY), saved); assert.throws(() => failed.getState().addManualCase(), /storage_not_loaded/);
  m.behavior.failRead = false; await failed.getState().retryHydration(); assert.equal(failed.getState().cases.length, 1);
  m.records.set(STORAGE_KEY, '{invalid'); const corrupt = await ready(m.storage);
  assert.equal(corrupt.getState().hydrationError, 'saved_data_unreadable');
  await corrupt.getState().recoverEmpty(); assert.equal(corrupt.getState().hydrationError, null); assert.equal(m.records.has(STORAGE_KEY), false);
});

test('reset sample preserves imported cases and drafts, deletion cleans only selected case', async () => {
  const m = memoryStorage(); const deleted: string[] = [];
  const store = await ready(m.storage, { deleteAttachments: async attachments => { deleted.push(...attachments.map(a => a.id)); } });
  const importedId = store.getState().addImportedCase(imported);
  store.getState().saveDraft(importedId, 'billing_correction', 'Imported case request', 'en');
  const sampleId = await store.getState().loadSample(); await store.getState().prepareDraft(sampleId, 'billing_correction');
  await store.getState().resetDemo(); assert.equal(store.getState().cases.length, 2);
  assert.equal(store.getState().drafts.length, 1); assert.equal(store.getState().drafts[0].caseId, importedId);
  await store.getState().deleteCase(importedId); assert.deepEqual(deleted, ['import']);
  assert.equal(store.getState().cases.length, 1); assert.equal(store.getState().drafts.length, 0);
});

test('duplicate review taps deduplicate and edits during review cannot publish stale findings', async () => {
  const m = memoryStorage(); let finish: ((value: ReviewResult) => void) | undefined; let calls = 0;
  const store = await ready(m.storage, { processBill: async () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  const caseId = await store.getState().loadSample(); const original = store.getState().cases[0];
  const first = store.getState().verifyCase(caseId); const second = store.getState().verifyCase(caseId);
  assert.equal(calls, 1); store.getState().updateCase(caseId, { provider: 'Changed while reviewing' });
  finish!(await documentService.processBill(original));
  await assert.rejects(first, /details_changed_during_review/); await assert.rejects(second, /details_changed_during_review/);
  assert.equal(store.getState().cases[0].status, 'needs_details'); assert.deepEqual(store.getState().cases[0].findings, []);
});

test('nonfinite amounts and invalid reminder dates cannot enter persisted state', async () => {
  const m = memoryStorage(); const store = await ready(m.storage); const caseId = await store.getState().loadSample();
  assert.throws(() => store.getState().updateCase(caseId, { financials: { ...store.getState().cases[0].financials, remainingCents: Number.NaN } }), /invalid_money/);
  assert.throws(() => store.getState().setFollowUp(caseId, '2026-02-30'), /invalid_date/);
  await store.getState().flushPersistence(); assert.equal(parseSnapshot(m.records.get(STORAGE_KEY)!).cases[0].financials.remainingCents, 49400);
});
