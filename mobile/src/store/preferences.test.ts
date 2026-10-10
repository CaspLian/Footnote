import test from 'node:test';
import assert from 'node:assert/strict';
import { createUnfoldStore } from './state';
import { parseSnapshot } from './persistence';
function storage() { const data = new Map<string, string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } }; }
test('theme defaults to system; voice, reading, interaction preferences and saved terms survive restart', async () => {
  const io = storage(); const store = createUnfoldStore(io); await store.getState().retryHydration();
  assert.equal(store.getState().preferences.theme, 'system');
  store.getState().setPreferences({ theme: 'dark', voice: 'warm', speechRate: 0.75, haptics: false, reduceMotion: true, billSort: 'follow_up', showResolved: false });
  store.getState().toggleSavedTerm('eob'); store.getState().toggleSavedTerm('appeal'); store.getState().toggleSavedTerm('appeal');
  await store.getState().flushPersistence(); const restored = createUnfoldStore(io); await restored.getState().retryHydration();
  assert.deepEqual(restored.getState().preferences, store.getState().preferences);
  assert.deepEqual(restored.getState().savedTermIds, ['eob']);
  restored.getState().setPreferences({ theme: 'system' }); assert.equal(restored.getState().preferences.voice, 'warm');
});
test('older and unsupported preference values recover without losing documents or drafts', async () => {
  const io = storage(); const store = createUnfoldStore(io); await store.getState().retryHydration(); const id = await store.getState().loadSample();
  store.getState().saveDraft(id, 'billing_correction', 'Keep this draft', 'en'); await store.getState().flushPersistence();
  const raw = JSON.parse(io.getItem('unfold-local-v1')!); delete raw.preferences; delete raw.savedTermIds;
  let restored = parseSnapshot(JSON.stringify(raw)); assert.equal(restored.preferences.theme, 'system'); assert.equal(restored.cases.length, 1); assert.equal(restored.drafts[0].body, 'Keep this draft');
  raw.preferences = { theme: 'purple', voice: 'unknown', speechRate: 99 }; raw.savedTermIds = ['eob', 'eob', 5, ''];
  restored = parseSnapshot(JSON.stringify(raw)); assert.equal(restored.preferences.voice, 'device'); assert.equal(restored.preferences.speechRate, 0.92); assert.deepEqual(restored.savedTermIds, ['eob']);
});

test('working language is normalized independently of UI locale and survives restart', async () => {
  const values = new Map<string, string>(); const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
  const first = createUnfoldStore(storage); await first.getState().retryHydration(); first.getState().setPreferences({ workingLanguage: 'hi' }); await first.getState().flushPersistence();
  const second = createUnfoldStore(storage); await second.getState().retryHydration(); assert.equal(second.getState().preferences.workingLanguage, 'hi'); assert.equal(second.getState().locale, 'en');
});

test('imported page batches stay together and unknown amounts remain unentered',async()=>{
  const io=storage();const store=createUnfoldStore(io);await store.getState().retryHydration();
  const attachments=[1,2,3].map(n=>({id:`page-${n}`,name:`page-${n}.jpg`,uri:`unfold-attachment://page-${n}`,mimeType:'image/jpeg',kind:'auto' as const,origin:'import' as const,importedAt:'2026-10-10T00:00:00Z'}));
  const id=store.getState().addImportedBatch(attachments);assert.equal(store.getState().cases.length,1);assert.equal(store.getState().cases[0].attachments.length,3);assert.equal(store.getState().cases[0].financials.remainingCents,undefined);
  store.getState().applyUnderstandingResult(id,{mode:'extracted',contextId:'gemini-context',details:{provider:'Test provider',serviceDate:'2026-10-10',financials:{eobResponsibilityCents:12000}}});
  store.getState().updateCase(id,{provider:'Test provider'});assert.equal(store.getState().cases[0].evidenceContextId,'gemini-context');
  await store.getState().flushPersistence();const restored=createUnfoldStore(io);await restored.getState().retryHydration();assert.equal(restored.getState().cases[0].financials.remainingCents,undefined);assert.equal(restored.getState().cases[0].evidenceContextId,'gemini-context');
  store.getState().addImportedBatch([{...attachments[0],id:'page-4'}],id);assert.equal(store.getState().cases[0].evidenceContextId,undefined);assert.equal(store.getState().cases[0].attachments.length,4);
});
