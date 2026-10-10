import { describe, expect, it } from 'vitest';
import { createBackend } from './backend';
import { fakeFetch, speechFixture } from './test-fixtures';

describe('createBackend', () => {
  it('is off without an address, and then sends nothing', async () => {
    const { fetch, calls } = fakeFetch([]);
    const api = createBackend('  ', { fetch });
    expect(api.configured).toBe(false);
    await expect(api.languages()).rejects.toMatchObject({ status: 0, message: 'backend_not_configured' });
    expect(calls).toHaveLength(0);
  });

  it('joins the paths it returns to its address', () => {
    const api = createBackend('http://127.0.0.1:8000/');
    expect(api.url('/api/v1/voice/audio/abc')).toBe('http://127.0.0.1:8000/api/v1/voice/audio/abc');
    expect(api.voiceSampleUrl('bunty')).toBe('http://127.0.0.1:8000/api/v1/voice/voices/bunty/sample');
  });

  it('sends every page in order, the language and the question to /api/v1/analyze', async () => {
    const { fetch, calls } = fakeFetch([{ body: { target_language: 'es-MX' } }]);
    const api = createBackend('http://api.test', { fetch });
    const pages = [new File(['a'], 'page-1.jpg', { type: 'image/jpeg' }), new File(['b'], 'page-2.pdf', { type: 'application/pdf' })];
    await api.analyze(pages, { language: 'es-MX', text: '  Why is it so high?  ' });
    expect(calls[0].url).toBe('http://api.test/api/v1/analyze');
    expect(calls[0].init.method).toBe('POST');
    const form = calls[0].init.body as FormData;
    expect((form.getAll('files') as File[]).map(file => file.name)).toEqual(['page-1.jpg', 'page-2.pdf']);
    expect(form.get('target_language')).toBe('es-MX');
    expect(form.get('text')).toBe('Why is it so high?');
  });

  it("passes on the backend's message and the stage that failed", async () => {
    const { fetch } = fakeFetch([
      { status: 400, body: { detail: "Unsupported language 'yue'. Use one of: en-US, en-GB" } },
      { status: 400, body: { detail: { stage: 'language', message: "Unsupported language 'yue'." } } },
      { status: 422, body: { detail: [{ loc: ['body', 'audit_id'], msg: 'Field required' }] } },
      { status: 502, body: null },
    ]);
    const api = createBackend('http://api.test', { fetch });
    await expect(api.analyze([], { language: 'yue' })).rejects.toMatchObject({ status: 400, message: expect.stringContaining('Use one of') });
    await expect(api.speak('x')).rejects.toMatchObject({ status: 400, stage: 'language' });
    await expect(api.speak('x')).rejects.toMatchObject({ status: 422, message: 'invalid_request' });
    await expect(api.voices()).rejects.toMatchObject({ status: 502, message: 'HTTP 502' });
  });

  it('tells an unreachable backend from a slow one', async () => {
    const unreachable = createBackend('http://api.test', { fetch: fakeFetch([new TypeError('Failed to fetch')]).fetch });
    await expect(unreachable.voices()).rejects.toMatchObject({ status: 0, message: 'unreachable' });
    const hanging = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as typeof fetch;
    const slow = createBackend('http://api.test', { fetch: hanging, lookupTimeoutMs: 10 });
    await expect(slow.benchmark('70450')).rejects.toMatchObject({ status: 0, message: 'timeout' });
  });

  it('asks for a reading of a saved analysis, in the chosen voice', async () => {
    const { fetch, calls } = fakeFetch([{ body: speechFixture() }]);
    const api = createBackend('http://api.test', { fetch });
    const speech = await api.speak('5b3c8f0e', 'alice');
    expect(calls[0].url).toBe('http://api.test/api/v1/voice/speak');
    const form = calls[0].init.body as FormData;
    expect([form.get('audit_id'), form.get('voice')]).toEqual(['5b3c8f0e', 'alice']);
    expect(speech.ok).toBe(true);
  });

  it('looks up codes and claims at their paths, encoded', async () => {
    const { fetch, calls } = fakeFetch([{ body: {} }, { body: {} }, { body: { audit_id: 'c1' } }, { body: {} }, { body: {} }]);
    const api = createBackend('http://api.test', { fetch });
    await api.benchmark(' 70450 ');
    await api.claim('a/b');
    await api.recordClaim({ items: [{ code: '70450', description: 'CT head', amount: 3200 }], analysis_audit_id: 'x' });
    await api.setClaimStatus('c1', 'dispute_in_progress', 'Letter sent');
    await api.logClaimAction('c1', 'Called provider');
    expect(calls.map(call => call.url)).toEqual([
      'http://api.test/api/v1/benchmarks/70450',
      'http://api.test/api/v1/claims/a%2Fb',
      'http://api.test/api/v1/claims',
      'http://api.test/api/v1/claims/c1/status',
      'http://api.test/api/v1/claims/c1/actions',
    ]);
    expect(JSON.parse(String(calls[3].init.body))).toEqual({ status: 'dispute_in_progress', note: 'Letter sent' });
    expect(JSON.parse(String(calls[4].init.body))).toEqual({ action: 'Called provider' });
  });
});
