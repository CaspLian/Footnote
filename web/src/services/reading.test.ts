import { describe, expect, it } from 'vitest';
import { createBackend } from './backend';
import { analyzeDocuments, claimFromCase } from './cases';
import { createReadings } from './reading';
import { analysisFixture, fakeFetch, speechFixture } from './test-fixtures';

describe('readings', () => {
  it('asks once per analysis and voice, and hands out the full audio address', async () => {
    const { fetch, calls } = fakeFetch([{ body: speechFixture() }, { body: speechFixture({ voice: 'george' }) }]);
    const readings = createReadings(createBackend('http://api.test', { fetch }));
    const [first, again] = await Promise.all([readings.prepare('a1'), readings.prepare('a1')]);
    expect(first).toBe(again);
    expect(first.url).toBe('http://api.test/api/v1/voice/audio/0123456789abcdef0123456789abcdef');
    expect(first.text).toBe('This is your hospital bill.');
    expect((await readings.prepare('a1', 'george')).voice).toBe('george'); // another voice is another clip
    expect(calls).toHaveLength(2);
  });

  it('does not remember a failure, so the next Listen tries again', async () => {
    const { fetch, calls } = fakeFetch([
      { body: speechFixture({ ok: false, audio_url: null, error_code: 'QUOTA_EXCEEDED' }) },
      { body: speechFixture() },
    ]);
    const readings = createReadings(createBackend('http://api.test', { fetch }));
    await expect(readings.prepare('a1')).rejects.toMatchObject({ message: 'QUOTA_EXCEEDED', stage: 'text_to_speech' });
    await expect(readings.prepare('a1')).resolves.toMatchObject({ voice: 'alice' });
    expect(calls).toHaveLength(2);
  });
});

describe('analyzeDocuments', () => {
  it('sends the app language as a locale and starts the reading at once', async () => {
    const { fetch, calls } = fakeFetch([{ body: analysisFixture({ target_language: 'es-MX' }) }, { body: speechFixture() }]);
    const api = createBackend('http://api.test', { fetch });
    const connected = await analyzeDocuments([new File(['x'], 'bill.jpg', { type: 'image/jpeg' })], 'es', { api, readings: createReadings(api) });
    expect((calls[0].init.body as FormData).get('target_language')).toBe('es-MX');
    expect(connected.analysis_language).toBe('es-MX');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(calls.map(call => call.url)).toEqual(['http://api.test/api/v1/analyze', 'http://api.test/api/v1/voice/speak']);
  });

  it('does not ask for a reading of an analysis that was not saved', async () => {
    const { fetch, calls } = fakeFetch([{ body: analysisFixture({ audit: { saved: false, audit_id: null, error: 'x' } }) }]);
    const api = createBackend('http://api.test', { fetch });
    await analyzeDocuments([], 'en', { api, readings: createReadings(api) });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(calls).toHaveLength(1);
  });
});

describe('claimFromCase', () => {
  it('sends the coded lines, linked to the analysis', async () => {
    const { fetch } = fakeFetch([{ body: analysisFixture() }]);
    const api = createBackend('http://api.test', { fetch });
    const connected = await analyzeDocuments([], 'en', { api, readings: { prepare: () => Promise.reject(new Error('off')) } });
    connected.line_items[2] = { ...connected.line_items[2], cpt_code: '' };
    expect(claimFromCase(connected, '2026-09-18')).toEqual({
      items: [
        { code: '70450', description: 'A scan of your head', amount: 3200 },
        { code: '99284', description: 'Emergency room visit', amount: 1200 },
      ],
      provider_name: 'Metropolitan Medical Center',
      service_date: '2026-09-18',
      total_billed: 4490,
      analysis_audit_id: '5b3c8f0e-1c6e-4d2a-9a77-3f1e2d4c5b6a',
    });
  });
});
