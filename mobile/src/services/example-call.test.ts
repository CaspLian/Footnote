import assert from 'node:assert/strict';
import test, { before } from 'node:test';
process.env.EXPO_PUBLIC_API_URL = 'http://backend.test';
let api: typeof import('./example-call');
before(async () => { api = await import('./example-call'); });

const audit = '00000000-0000-4000-8000-000000000001';
test('only a saved, unedited reading can be acted out', () => {
  assert.equal(api.canHearExampleCall({ evidenceContextId: audit }), true);
  assert.equal(api.canHearExampleCall({ evidenceContextId: audit, entriesEdited: true }), false);
  assert.equal(api.canHearExampleCall({ evidenceContextId: 'sample-1' }), false);
  assert.equal(api.canHearExampleCall({}), false);
});
test('the request sends the saved analysis, language, voice and who is called as form fields', async () => {
  let form: FormData | undefined; let url = '';
  globalThis.fetch = (async (input, init) => { url = String(input); form = init?.body as FormData; return Response.json({ audio_url: '/api/v1/voice/audio/abc', mime_type: 'audio/mpeg', turns: [{ speaker: 'representative', text: 'Hello.' }], voices: { patient: 'anamaria', representative: 'george' }, counterpart: 'billing' }); }) as typeof fetch;
  const found = await api.requestExampleCall(audit, 'es-MX', 'anamaria', 'billing');
  assert.equal(url, 'http://backend.test/api/v1/voice/example-call');
  assert.deepEqual([form?.get('audit_id'), form?.get('target_language'), form?.get('voice'), form?.get('counterpart')], [audit, 'es-MX', 'anamaria', 'billing']);
  assert.equal(found.turns[0].text, 'Hello.');
});
