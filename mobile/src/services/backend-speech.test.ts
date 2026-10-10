import assert from 'node:assert/strict';
import test from 'node:test';

// Set before backend.ts is loaded: it reads the address once.
process.env.EXPO_PUBLIC_API_URL = 'http://backend.test';

const spoken = { ok: true, audio_url: '/api/v1/voice/audio/abc', voice: 'matilda', text: 'Hi.', error_code: null, error_message: null };

test('a reading is requested once per analysis, shared by every caller, and retried after a failure', async () => {
  const calls: string[] = [];
  let fail = true;
  globalThis.fetch = (async (url: string | URL | Request) => {
    calls.push(String(url));
    if (fail) { fail = false; return new Response(JSON.stringify({ detail: { stage: 'audit', message: 'Tiger Data unavailable' } }), { status: 503 }); }
    return new Response(JSON.stringify(spoken), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const { prepareSpeech } = await import('./backend-speech');

  await assert.rejects(prepareSpeech('audit-1'));
  // The intake's early request and the review's request share one call: the clip is never asked for twice.
  const [early, review] = await Promise.all([prepareSpeech('audit-1'), prepareSpeech('audit-1')]);
  assert.equal(early, 'http://backend.test/api/v1/voice/audio/abc');
  assert.equal(review, early);
  assert.equal(await prepareSpeech('audit-1'), early);
  assert.deepEqual(calls, ['http://backend.test/api/v1/voice/speak', 'http://backend.test/api/v1/voice/speak']);
});

test('a voice that could not be made is reported, not played', async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ ...spoken, ok: false, audio_url: null, error_code: 'QUOTA_EXCEEDED' }),
    { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  const { prepareSpeech } = await import('./backend-speech');
  await assert.rejects(prepareSpeech('audit-2'), /QUOTA_EXCEEDED/);
});
