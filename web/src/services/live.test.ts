import { describe, expect, it } from 'vitest';
import { createBackend } from './backend';
import { analyzeDocuments } from './cases';
import { createReadings } from './reading';

// Against a running backend, with real Gemini, Snowflake, ElevenLabs and Tiger Data calls:
//   VITE_LIVE_API_URL=http://127.0.0.1:8000 npx vitest run src/services/live.test.ts
// Skipped otherwise. The bill is synthetic.
const LIVE = String(import.meta.env.VITE_LIVE_API_URL ?? '');
const BILL = 'Hospital bill: CPT 70450 CT head without contrast, $3,200. CPT 99284 emergency room visit, $1,200. '
  + 'CPT 80053 comprehensive metabolic panel, $90. Why is it so expensive?';

describe.skipIf(!LIVE)('the live backend', () => {
  const api = createBackend(LIVE);
  const readings = createReadings(api);

  it('lists the languages and the voices', async () => {
    expect(Object.keys(await api.languages())).toHaveLength(42);
    const voices = await api.voices();
    expect(voices.default).toBe('matilda');
    expect(voices.language_defaults.es).toBe('elio');
  });

  it('looks up a Medicare rate', async () => {
    const benchmark = await api.benchmark('70450');
    expect(benchmark.medicare_rate).toBeGreaterThan(0);
  });

  it('analyzes a bill in Spanish, flags the outliers, and reads it aloud with ElevenLabs', async () => {
    const connected = await analyzeDocuments([], 'es', { api, readings, text: BILL });
    expect(connected.analysis_language).toBe('es-MX');
    expect(connected.audit_id).toBeTruthy();
    expect(connected.findings.map(f => f.cpt_code)).toContain('70450');
    const reading = await readings.prepare(connected.audit_id!);
    expect(reading.voice).toBe('elio');
    expect(reading.text).toContain('Medicare');
    const audio = await fetch(reading.url);
    expect(audio.status).toBe(200);
    expect(audio.headers.get('content-type')).toBe('audio/mpeg');
    expect((await audio.arrayBuffer()).byteLength).toBeGreaterThan(10_000);
    const saved = await api.audit(connected.audit_id!);
    expect(saved.analysis.target_language).toBe('es-MX');
  }, 240_000);
});
