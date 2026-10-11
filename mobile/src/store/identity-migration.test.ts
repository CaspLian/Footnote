import assert from 'node:assert/strict';
import test from 'node:test';
import { createFootnoteStore, snapshotOf, type LocalStorage } from './state';
import { STORAGE_KEY, parseSnapshot } from './persistence';
import { LEGACY_STORAGE_KEY, LEGACY_ATTACHMENT_PREFIX } from '../domain/legacy-identity';

function storageWith(records = new Map<string, string>()) {
  const behavior = { failWrite: false };
  const storage: LocalStorage = {
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => { if (behavior.failWrite) throw new Error('quota'); records.set(key, value); },
    removeItem: key => { records.delete(key); },
  };
  return { storage, records, behavior };
}
async function legacySnapshot() {
  const seed = storageWith();
  const store = createFootnoteStore(seed.storage, { autoHydrate: false });
  await store.getState().retryHydration();
  store.getState().completeOnboarding({ firstName: 'Pat', relationship: 'self', zipCode: '', coverage: 'unsure', insurer: '', planName: '' }, { explanationDepth: 'detailed', goal: 'understand' });
  const caseId = store.getState().addImportedCase({ id: 'saved-document', uri: `${LEGACY_ATTACHMENT_PREFIX}saved-document`, name: 'Bill.pdf', mimeType: 'application/pdf', kind: 'bill', origin: 'import', importedAt: '2026-10-10T12:00:00Z' });
  store.getState().updateCase(caseId, { provider: 'Saved provider', serviceDate: '2026-09-18', financials: { remainingCents: 194000 } });
  store.getState().saveDraft(caseId, 'billing_correction', 'Keep my edited request', 'en');
  store.getState().setFollowUp(caseId, '2026-10-20');
  await store.getState().flushPersistence();
  return JSON.stringify(snapshotOf(store.getState()));
}

test('the renamed workspace migrates saved profiles, bills, document URIs, drafts and actions', async () => {
  const serialized = await legacySnapshot();
  const fixture = storageWith(new Map([[LEGACY_STORAGE_KEY, serialized]]));
  const store = createFootnoteStore(fixture.storage, { autoHydrate: false });
  await store.getState().retryHydration();
  assert.equal(store.getState().hydrationError, null);
  assert.equal(store.getState().profiles[0].firstName, 'Pat');
  assert.equal(store.getState().cases[0].financials.remainingCents, 194000);
  assert.equal(store.getState().cases[0].attachments[0].uri, `${LEGACY_ATTACHMENT_PREFIX}saved-document`);
  assert.equal(store.getState().drafts[0].body, 'Keep my edited request');
  assert.equal(store.getState().cases[0].followUpDate, '2026-10-20');
  assert.equal(store.getState().events.length, parseSnapshot(serialized).events.length);
  assert.deepEqual(parseSnapshot(fixture.records.get(STORAGE_KEY)!), parseSnapshot(serialized));
  assert.equal(fixture.records.get(LEGACY_STORAGE_KEY), serialized);
});

test('a migration write failure keeps all recovered data usable and allows retry', async () => {
  const fixture = storageWith(new Map([[LEGACY_STORAGE_KEY, await legacySnapshot()]]));
  fixture.behavior.failWrite = true;
  const store = createFootnoteStore(fixture.storage, { autoHydrate: false });
  await store.getState().retryHydration();
  assert.equal(store.getState().hydrationError, null);
  assert.equal(store.getState().storageError, 'storage_unavailable');
  assert.equal(store.getState().drafts[0].body, 'Keep my edited request');
  fixture.behavior.failWrite = false;
  await store.getState().retryPersistence();
  assert.equal(parseSnapshot(fixture.records.get(STORAGE_KEY)!).profiles[0].firstName, 'Pat');
});

test('current saved data takes precedence over the earlier snapshot', async () => {
  const earlier = await legacySnapshot();
  const current = parseSnapshot(earlier); current.profiles[0].firstName = 'Updated';
  const fixture = storageWith(new Map([[LEGACY_STORAGE_KEY, earlier], [STORAGE_KEY, JSON.stringify(current)]]));
  const store = createFootnoteStore(fixture.storage, { autoHydrate: false });
  await store.getState().retryHydration();
  assert.equal(store.getState().profiles[0].firstName, 'Updated');
});

test('explicit empty-data recovery removes both keys so earlier bills cannot reappear', async () => {
  const fixture = storageWith(new Map([[LEGACY_STORAGE_KEY, await legacySnapshot()]]));
  const store = createFootnoteStore(fixture.storage, { autoHydrate: false });
  await store.getState().retryHydration();
  await store.getState().recoverEmpty();
  const reopened = createFootnoteStore(fixture.storage, { autoHydrate: false });
  await reopened.getState().retryHydration();
  assert.equal(reopened.getState().cases.length, 0);
  assert.equal(reopened.getState().profiles.length, 0);
  assert.equal(fixture.records.has(LEGACY_STORAGE_KEY), false);
});
