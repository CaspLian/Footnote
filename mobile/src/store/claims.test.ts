import assert from 'node:assert/strict';
import test from 'node:test';
import { createUnfoldStore, type LocalStorage } from './state';
import type { BillCase, ClaimChange, ClaimTracker, DocumentAttachment } from '../domain/types';

function memoryStorage(): LocalStorage {
  const records = new Map<string, string>();
  return { async getItem(key) { return records.get(key) ?? null; }, async setItem(key, value) { records.set(key, value); }, async removeItem(key) { records.delete(key); } };
}
const clock = () => '2026-10-10T17:00:00.000Z';
let sequence = 0;
const id = (prefix: string) => `${prefix}-${++sequence}`;
const settle = () => new Promise(resolve => setTimeout(resolve, 0)); // claim tracking runs after the action returns
const imported: DocumentAttachment = { id: 'import', uri: 'file:///app/unfold/a.jpg', name: 'Bill.jpg', mimeType: 'image/jpeg', kind: 'bill', origin: 'import', importedAt: clock() };

function fakeTracker(fail = false) {
  const recorded: BillCase[] = [];
  const updates: [string, ClaimChange][] = [];
  const tracker: ClaimTracker = {
    async record(billCase) { if (fail) throw new Error('Tiger Data down'); recorded.push(billCase); return 'claim-1'; },
    async update(claimId, change) { if (fail) throw new Error('Tiger Data down'); updates.push([claimId, change]); },
    async deadlines() { if (fail) throw new Error('Tiger Data down'); return { creditWarningDate: '2027-03-13', creditWarningIsEstimate: true, collectionIsEstimate: false }; },
  };
  return { tracker, recorded, updates };
}

async function confirmedCase(claims: ClaimTracker) {
  const store = createUnfoldStore(memoryStorage(), {
    now: clock, id, autoHydrate: false, claims, processBill: async () => ({ mode: 'manual', findings: [], summary: { en: 'Summary.', es: 'Resumen.' } }),
  });
  await store.getState().retryHydration();
  const caseId = store.getState().addImportedCase(imported);
  store.getState().updateCase(caseId, {
    provider: 'Metropolitan Medical Center', serviceDate: '2026-09-14',
    financials: { billedCents: 365000, adjustmentCents: 0, postAdjustmentCents: 365000, patientPaidCents: 0, remainingCents: 182550 },
    lineItems: [{ id: 'l1', description: { en: 'ER visit', es: 'ER visit' }, code: '99285', date: '2026-09-14', units: 1, billedCents: 245000,
      evidence: { attachmentId: 'import', page: 1, label: { en: 'Line 1', es: 'Línea 1' }, excerpt: { en: 'ER VISIT', es: 'ER VISIT' } } }],
  });
  await store.getState().verifyCase(caseId);
  await settle();
  return { store, caseId };
}

test('confirming a case records its claim once and marks the audit complete; later steps update that claim', async () => {
  const fake = fakeTracker();
  const { store, caseId } = await confirmedCase(fake.tracker);
  assert.equal(fake.recorded.length, 1);
  assert.equal(fake.recorded[0].provider, 'Metropolitan Medical Center');
  assert.equal(store.getState().cases.find(c => c.id === caseId)?.claimId, 'claim-1');
  assert.deepEqual(fake.updates, [['claim-1', { status: 'audit_complete' }]]);
  // Tiger Data's estimate from the bill's dates is kept on the case for the timeline.
  assert.deepEqual(store.getState().cases.find(c => c.id === caseId)?.claimDeadlines, { creditWarningDate: '2027-03-13', creditWarningIsEstimate: true, collectionIsEstimate: false });

  // Editing and confirming again keeps the same claim: nothing is recorded twice.
  store.getState().updateCase(caseId, { provider: 'Metropolitan Medical Center (corrected)' });
  await store.getState().verifyCase(caseId);
  await settle();
  assert.equal(fake.recorded.length, 1);

  const draftId = store.getState().saveDraft(caseId, 'billing_correction', 'Please explain code 99285.', 'en');
  store.getState().markSubmitted(draftId);
  store.getState().setFollowUp(caseId, '2026-11-15');
  store.getState().setNoticeDeadline(caseId, '2026-12-01');
  store.getState().setNoticeDeadline(caseId, null); // Tiger Data cannot clear a date, so the removal is logged as an action
  store.getState().markResolved(caseId);
  await settle();
  assert.deepEqual(fake.updates.slice(2), [
    ['claim-1', { status: 'dispute_in_progress' }],
    ['claim-1', { action: 'Follow-up reminder set', note: '2026-11-15' }],
    ['claim-1', { collectionDeadline: '2026-12-01' }],
    ['claim-1', { action: 'Notice date removed' }],
    ['claim-1', { finalCents: 182550 }],
  ]);
});

test('the synthetic sample is never recorded', async () => {
  const fake = fakeTracker();
  const store = createUnfoldStore(memoryStorage(), { now: clock, id, autoHydrate: false, claims: fake.tracker });
  await store.getState().retryHydration();
  const caseId = await store.getState().loadSample();
  await store.getState().verifyCase(caseId);
  store.getState().markResolved(caseId);
  await settle();
  assert.equal(fake.recorded.length, 0);
  assert.equal(fake.updates.length, 0);
});

test('Tiger Data being down never breaks the review or the case', async () => {
  const fake = fakeTracker(true);
  const { store, caseId } = await confirmedCase(fake.tracker);
  const confirmed = store.getState().cases.find(c => c.id === caseId);
  assert.equal(confirmed?.status, 'ready');
  assert.equal(confirmed?.claimId, undefined);
  assert.doesNotThrow(() => store.getState().markResolved(caseId));
});
