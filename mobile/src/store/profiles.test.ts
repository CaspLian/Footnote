import test from 'node:test';
import assert from 'node:assert/strict';
import { createFootnoteStore } from './state';
import { parseSnapshot } from './persistence';
const profile={firstName:'Alex',relationship:'self' as const,zipCode:'11367',coverage:'private' as const,insurer:'Local plan',planName:'Choice'};
const context={explanationDepth:'simple' as const,goal:'understand' as const};
function backend(){const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);},removeItem:(k:string)=>{m.delete(k);}};}
test('onboarding, local child profiles and profile-linked cases survive a restart',async()=>{const storage=backend();const store=createFootnoteStore(storage);await store.getState().retryHydration();store.getState().completeOnboarding(profile,context);const self=store.getState().profiles[0];const child=store.getState().saveProfile({...profile,firstName:'Jamie',relationship:'child',ageGroup:'under18'});store.getState().setActiveProfile(child);const id=store.getState().addManualCase();assert.equal(store.getState().cases[0].profileId,child);await store.getState().flushPersistence();const reload=createFootnoteStore(storage);await reload.getState().retryHydration();assert.equal(reload.getState().onboardingCompleted,true);assert.equal(reload.getState().profiles.length,2);assert.equal(reload.getState().activeProfileId,child);assert.equal(reload.getState().cases.find(c=>c.id===id)?.profileId,child);reload.getState().removeProfile(child);assert.equal(reload.getState().cases.length,1);assert.equal(reload.getState().cases[0].profileId,undefined);assert.equal(reload.getState().activeProfileId,self.id);});
test('profile removal preserves drafts; primary profile cannot be removed',async()=>{const store=createFootnoteStore(backend());await store.getState().retryHydration();store.getState().completeOnboarding(profile,context);assert.throws(()=>store.getState().removeProfile(store.getState().profiles[0].id));const child=store.getState().saveProfile({...profile,firstName:'Jamie',relationship:'child'});store.getState().setActiveProfile(child);const id=store.getState().addManualCase();store.getState().saveDraft(id,'billing_correction','A saved question','en');store.getState().removeProfile(child);assert.equal(store.getState().drafts[0].body,'A saved question');assert.throws(()=>store.getState().saveProfile({...profile,firstName:'',relationship:'child'}));assert.throws(()=>store.getState().saveProfile({...profile,zipCode:'123',relationship:'child'}));});
test('confirmed deadline is separate from follow-up; case completion is idempotent',async()=>{const store=createFootnoteStore(backend());await store.getState().retryHydration();const id=store.getState().addManualCase();store.getState().setFollowUp(id,'2026-10-20');store.getState().setNoticeDeadline(id,'2026-11-01');assert.equal(store.getState().cases[0].followUpDate,'2026-10-20');assert.equal(store.getState().cases[0].noticeDeadline,'2026-11-01');assert.throws(()=>store.getState().setNoticeDeadline(id,'2026-02-30'));store.getState().markResolved(id);store.getState().markResolved(id);assert.equal(store.getState().events.filter(e=>e.kind==='resolved').length,1);assert.equal(store.getState().cases[0].status,'resolved');await store.getState().flushPersistence();});
test('old local workspaces retain bills while requiring personal onboarding',async()=>{const b=backend();const store=createFootnoteStore(b);await store.getState().retryHydration();await store.getState().loadSample();await store.getState().flushPersistence();const snapshot=JSON.parse(b.getItem('footnote-local-v1')!);delete snapshot.profiles;delete snapshot.onboardingCompleted;delete snapshot.personalContext;const restored=parseSnapshot(JSON.stringify(snapshot));assert.equal(restored.cases.length,1);assert.equal(restored.onboardingCompleted,false);assert.deepEqual(restored.profiles,[]);});

test('saved Brazil Portuguese preferences recover to Portugal without losing profiles or cases', async () => {
  const storage = backend(), store = createFootnoteStore(storage); await store.getState().retryHydration();
  store.getState().completeOnboarding(profile, context); await store.getState().loadSample(); await store.getState().flushPersistence();
  const snapshot = JSON.parse(storage.getItem('footnote-local-v1')!); snapshot.preferences.workingLanguage = 'pt-BR';
  storage.setItem('footnote-local-v1', JSON.stringify(snapshot));
  const restart = createFootnoteStore(storage); await restart.getState().retryHydration();
  assert.equal(restart.getState().preferences.workingLanguage, 'pt-PT');
  assert.deepEqual(restart.getState().profiles, snapshot.profiles);
  assert.deepEqual(restart.getState().cases, snapshot.cases);
  assert.equal(restart.getState().onboardingCompleted, true);
});

test('Other relationship is normalized, validated and retained after restart', async () => {
  const storage = backend(), store = createFootnoteStore(storage); await store.getState().retryHydration();
  store.getState().completeOnboarding(profile, context);
  for (const relationshipLabel of ['', '   ', 'Friend!', 'Sibling/guardian', 'A'.repeat(41), 'Friend\t2', '<script>']) {
    assert.throws(() => store.getState().saveProfile({ ...profile, relationship: 'other', relationshipLabel }));
  }
  const id = store.getState().saveProfile({ ...profile, firstName: 'Sam', relationship: 'other', relationshipLabel: '  Cousin  2  ' });
  const accented = store.getState().saveProfile({ ...profile, firstName: 'Ana', relationship: 'other', relationshipLabel: 'Família' });
  store.getState().setActiveProfile(id); await store.getState().flushPersistence();
  const restart = createFootnoteStore(storage); await restart.getState().retryHydration();
  assert.equal(restart.getState().profiles.find(p => p.id === id)?.relationshipLabel, 'Cousin 2');
  assert.equal(restart.getState().profiles.find(p => p.id === accented)?.relationshipLabel, 'Família');
  assert.equal(restart.getState().activeProfileId, id);
  const serialized = JSON.parse(storage.getItem('footnote-local-v1')!);
  serialized.profiles.find((p: { id: string }) => p.id === id).relationshipLabel = 'Friend!';
  assert.throws(() => parseSnapshot(JSON.stringify(serialized)));
  restart.getState().saveProfile({ ...restart.getState().profiles.find(p => p.id === id)!, relationship: 'child' });
  assert.equal(restart.getState().profiles.find(p => p.id === id)?.relationshipLabel, undefined);
});
