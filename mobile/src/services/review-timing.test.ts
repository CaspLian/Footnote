import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewWithMinimumDuration } from './review-timing';

test('fast successful review holds for six seconds in total; a slow review adds no delay', async () => {
  for (const [workMs, expected] of [[200, 5800], [8000, 0]]) {
    let clock = 0, waited = 0;
    await reviewWithMinimumDuration(async () => { clock += workMs; }, { signal: new AbortController().signal, now: () => clock, wait: async ms => { waited += ms; } });
    assert.equal(waited, expected);
  }
});
test('failed or cancelled reviews never become a completed paced review', async () => {
  let waited = false;
  await assert.rejects(reviewWithMinimumDuration(async () => { throw new Error('backend down'); }, { signal: new AbortController().signal, wait: async () => { waited = true; } }), /backend down/);
  assert.equal(waited, false);
  const abort = new AbortController();
  await assert.rejects(reviewWithMinimumDuration(async () => { abort.abort(); }, { signal: abort.signal }), { name: 'AbortError' });
});
