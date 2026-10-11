import test from 'node:test';
import assert from 'node:assert/strict';
import { claimAudio } from './audio-focus';

test('a new audio claim stops the previous holder once; stale release never clears a newer holder', () => {
  const stopped: string[] = [];
  const releaseA = claimAudio({ stop: () => stopped.push('a') });
  const releaseB = claimAudio({ stop: () => stopped.push('b') });
  releaseA();
  const releaseC = claimAudio({ stop: () => stopped.push('c') });
  assert.deepEqual(stopped, ['a', 'b']);
  releaseB(); releaseC();
  const releaseD = claimAudio({ stop: () => stopped.push('d') });
  assert.deepEqual(stopped, ['a', 'b']); releaseD();
});

test('an old player failing to stop does not prevent the next claim', () => {
  claimAudio({ stop() { throw new Error('old player failed'); } });
  let stopped = 0;
  const release = claimAudio({ stop() { stopped++; } });
  const next = claimAudio({ stop() {} });
  assert.equal(stopped, 1); release(); next();
});
