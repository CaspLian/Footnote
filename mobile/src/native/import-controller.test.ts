import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ImportController, type ImportAdapter } from './import-controller';
import type { ImportResult } from './documents';
import type { DocumentAttachment } from '../domain/types';
const attachment: DocumentAttachment = { id: 'photo', uri: 'file://private/photo.jpg', name: 'photo.jpg', mimeType: 'image/jpeg', origin: 'import', kind: 'auto', importedAt: '2026-10-10T12:00:00Z' };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function fixture(pick: ImportAdapter['pick'], commitFails = false) {
  const calls: string[] = [];
  const controller = new ImportController({ pick, paint: async () => { calls.push('paint'); }, commit: (a, id) => { if (commitFails) throw new Error('storage'); calls.push(`commit:${a.kind}:${id ?? 'new'}`); return id ?? 'case'; }, discard: async () => { calls.push('discard'); }, advance: id => { calls.push(`advance:${id}`); } });
  return { controller, calls };
}
test('import paints its preparation state before committing and advances only after a saved copy is ready for confirmation', async () => {
  const io = deferred<ImportResult>();
  const { controller, calls } = fixture(async (_source, kind, prepare) => { assert.equal(kind, 'auto'); await prepare({ name: attachment.name }); return io.promise; });
  const run = controller.run('camera');
  assert.deepEqual(controller.getSnapshot(), { phase: 'preparing', filename: 'photo.jpg' });
  assert.deepEqual(calls, ['paint']);
  await controller.run('camera'); // A second tap cannot start another picker.
  io.resolve({ status: 'success', attachment }); await run;
  assert.deepEqual(calls, ['paint', 'commit:auto:new', 'advance:case']);
  assert.equal(controller.getSnapshot().phase, 'idle');
});
test('cancelling during preparation discards the copy without a case or navigation', async () => {
  const io = deferred<ImportResult>();
  const { controller, calls } = fixture(async (_s, _k, prepare) => { await prepare({ name: attachment.name }); return io.promise; });
  const run = controller.run('files'); controller.cancel(); io.resolve({ status: 'success', attachment }); await run;
  assert.deepEqual(calls, ['paint', 'discard']); assert.equal(controller.getSnapshot().phase, 'idle');
});
test('picker cancellation, permission denial and invalid files leave a recoverable idle state', async () => {
  for (const result of [{ status: 'cancelled' }, { status: 'permission-denied', canAskAgain: false }, { status: 'error', code: 'invalid-pdf', message: { en: 'This PDF is invalid.', es: 'PDF inválido.' } }] as ImportResult[]) {
    const { controller, calls } = fixture(async () => result); await controller.run('files');
    assert.deepEqual(calls, []); assert.equal(controller.getSnapshot().phase, 'idle');
    assert.equal(controller.getSnapshot().denied, result.status === 'permission-denied' ? true : undefined);
    assert.equal(!!controller.getSnapshot().error, result.status !== 'cancelled');
  }
});
test('a failed commit cleans up the copied attachment and does not advance', async () => {
  const { controller, calls } = fixture(async () => ({ status: 'success', attachment }), true); await controller.run('files');
  assert.deepEqual(calls, ['discard']); assert.ok(controller.getSnapshot().error);
});
test('late completion from an abandoned picker cannot replace a newer import state', async () => {
  const old = deferred<ImportResult>(), next = deferred<ImportResult>(); let attempt = 0;
  const { controller, calls } = fixture(async (_s, _k, prepare) => { if (++attempt === 1) return old.promise; await prepare({ name: 'new.pdf' }); return next.promise; });
  const oldRun = controller.run('camera'); controller.cancel(); const newRun = controller.run('files', 'eob', 'existing');
  old.resolve({ status: 'success', attachment }); await oldRun;
  assert.equal(controller.getSnapshot().filename, 'new.pdf');
  next.resolve({ status: 'success', attachment: { ...attachment, kind: 'eob' } }); await newRun;
  assert.deepEqual(calls, ['paint', 'discard', 'commit:eob:existing', 'advance:existing']);
});

test('multi-photo selection commits one batch and advances once; cancelled batches discard every copy', async () => {
  const additional = [{...attachment,id:'page-2'},{...attachment,id:'page-3'}]; let commits=0, count=0, advances=0;
  const controller = new ImportController({pick:async()=>({status:'success',attachment,additionalAttachments:additional}),paint:async()=>{},commit:(_a,_id,rest)=>{commits++;count=1+(rest?.length??0);return 'batch';},discard:async()=>{},advance:()=>{advances++;}});
  await controller.run('photos'); assert.equal(commits,1); assert.equal(count,3); assert.equal(advances,1);
  const io=deferred<ImportResult>();let discarded=0;
  const cancelled=new ImportController({pick:async()=>io.promise,paint:async()=>{},commit:()=>{throw Error('unexpected');},discard:async()=>{discarded++;},advance:()=>{throw Error('unexpected');}});
  const run=cancelled.run('photos');cancelled.cancel();io.resolve({status:'success',attachment,additionalAttachments:additional});await run;assert.equal(discarded,3);
});
