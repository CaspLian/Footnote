import test from 'node:test';
import assert from 'node:assert/strict';
import { UnderstandingController, type UnderstandingAdapter, type UnderstandingRequest } from './document-understanding';
import { createSampleCase } from '../domain/fixtures';
const sample = createSampleCase();
const request: UnderstandingRequest = { caseId: sample.id, attachments: sample.attachments, workingLanguage: 'en', personalContext: { explanationDepth: 'simple', goal: 'understand' } };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
test('one bill, one EOB, or both enter understanding without requiring a document pair', async () => {
  for (const attachments of [[sample.attachments[0]], [sample.attachments[1]], sample.attachments]) {
    let called = 0;
    const controller = new UnderstandingController({ async understand(r) { called++; assert.equal(r.attachments.length, attachments.length); return { mode: 'manual' }; } });
    await controller.run({ ...request, attachments }); assert.equal(called, 1); assert.equal(controller.getSnapshot().status, 'complete');
  }
});
test('a slow adapter keeps the understanding screen working until its actual result, with no invented progress', async () => {
  const wait = deferred<{mode:'extracted'; contextId:string}>(); let calls = 0;
  const controller = new UnderstandingController({ understand(_, { onPhase }) { calls++; onPhase('organizing'); return wait.promise; } });
  const run = controller.run(request); assert.equal(controller.getSnapshot().status, 'working'); assert.equal(controller.getSnapshot().phase, 'organizing');
  await controller.run(request); assert.equal(calls, 1); wait.resolve({ mode: 'extracted', contextId: 'context-1' }); await run;
  assert.equal(controller.getSnapshot().result?.contextId, 'context-1');
});
test('cancelled understanding cannot replace a newer result even if the backend ignores cancellation', async () => {
  const wait = deferred<{mode:'manual'}>(); let calls = 0;
  const adapter: UnderstandingAdapter = { async understand() { return ++calls === 1 ? wait.promise : { mode:'extracted', contextId:'new' }; } };
  const controller = new UnderstandingController(adapter); const run = controller.run(request); controller.cancel(); await controller.run(request); wait.resolve({ mode:'manual' }); await run;
  assert.equal(controller.getSnapshot().result?.contextId, 'new');
});
test('empty documents and failed understanding expose recovery; a retry can complete', async () => {
  let calls = 0; const controller = new UnderstandingController({ async understand() { if (++calls === 1) throw Error('network'); return { mode:'manual' }; } });
  await controller.run({...request,attachments:[]}); assert.equal(calls,0); assert.equal(controller.getSnapshot().status,'error');
  await controller.run(request); assert.equal(controller.getSnapshot().status,'error'); await controller.run(request); assert.equal(controller.getSnapshot().status,'complete');
});
