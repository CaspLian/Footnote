import type { AnalyzeResponse, Speech } from './backend';

/** Shaped like a live POST /api/v1/analyze answer (en-GB, 2026-10-10), for a synthetic bill. */
export function analysisFixture(overrides: Partial<AnalyzeResponse> = {}): AnalyzeResponse {
  return {
    target_language: 'en-GB',
    model: 'gemini-3.5-flash',
    mock: false,
    result: {
      document_type: 'hospital_bill',
      provider_name: 'Metropolitan Medical Center',
      total_billed: 4490,
      amount_patient_owes: 4490,
      due_date: '2026-11-01',
      line_items: [
        { cpt_code: '70450', original_description: 'CT HEAD W/O CONTRAST', plain_description: 'A scan of your head', billed_amount: 3200,
          date_of_service: '2026-09-18', source_page: 1, possible_issues: [] },
        { cpt_code: '99284', original_description: 'ER VISIT LEVEL 4', plain_description: 'Emergency room visit', billed_amount: 1200,
          date_of_service: '2026-09-18', source_page: 1, possible_issues: ['The visit level is not explained.'] },
        { cpt_code: '80053', original_description: 'COMP METABOLIC PANEL', plain_description: 'Blood test', billed_amount: 90,
          date_of_service: '2026-09-18', source_page: 1, possible_issues: [] },
      ],
      plain_summary: 'This is your hospital bill for an emergency room visit.',
      spoken_summary: 'This is your hospital bill for an emergency room visit. The total is four thousand four hundred ninety dollars.',
      questions_to_ask: ['Can you send me an itemized bill?', 'Was my insurance billed?'],
    },
    price_checks: [
      { line_index: 0, cpt_code: '70450', billed_amount: 3200, medicare_rate: 106.03, medicare_description: 'CT head/brain w/o dye',
        times_medicare: 30.2, flag: 'far_above_typical', note: "Medicare's rate here covers only the doctor's fee." },
      { line_index: 1, cpt_code: '99284', billed_amount: 1200, medicare_rate: 118.82, medicare_description: 'Emergency dept visit',
        times_medicare: 10.1, flag: 'far_above_typical', note: '' },
      { line_index: 2, cpt_code: '80053', billed_amount: 90, medicare_rate: 10.56, medicare_description: 'Comprehensive metabolic panel',
        times_medicare: 8.5, flag: 'typical', note: '' },
    ],
    price_summary: { source: 'snowflake', items_checked: 3, items_flagged: 2, billed_total_checked: 4490, medicare_total_checked: 235.41, error: null },
    audit: { saved: true, audit_id: '5b3c8f0e-1c6e-4d2a-9a77-3f1e2d4c5b6a', error: null },
    ...overrides,
  };
}

export function speechFixture(overrides: Partial<Speech> = {}): Speech {
  return {
    ok: true,
    audio_url: '/api/v1/voice/audio/0123456789abcdef0123456789abcdef',
    mime_type: 'audio/mpeg',
    voice: 'alice',
    streaming: false,
    text: 'This is your hospital bill.',
    error_code: null,
    error_message: null,
    ...overrides,
  };
}

interface Reply {
  status?: number;
  body?: unknown;
}

/** A stand-in for fetch: answers in order and records every request. */
export function fakeFetch(replies: (Reply | Error)[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    const next = replies.shift() ?? { body: {} };
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next.body ?? null), {
      status: next.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}
