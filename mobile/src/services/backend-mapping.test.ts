import assert from 'node:assert/strict';
import test from 'node:test';
import { mapGeminiAnalysis, type GeminiAnalyzeResponse } from '../domain/extraction';
import { createManualCase } from '../domain/fixtures';
import type { BillCase, DocumentAttachment } from '../domain/types';
import type { BackendBenchmark } from './backend';
import { comparisonFor, normalizeCode, reviewFindings } from './backend-mapping';

// Two camera pages, as the camera screen saves them.
const page = (n: number): DocumentAttachment => ({
  id: `page-${n}`, uri: `file:///page-${n}.jpg`, name: `page-${n}.jpg`, mimeType: 'image/jpeg', kind: 'bill', origin: 'import', importedAt: '2026-10-10T12:00:00Z',
});

// The shape POST /api/v1/analyze returns (synthetic values).
function response(audit: GeminiAnalyzeResponse['audit'] = { saved: true, audit_id: '00000000-0000-4000-8000-000000000001', error: null }): GeminiAnalyzeResponse {
  return {
    target_language: 'en', model: 'gemini-3.5-flash', mock: false, price_checks: [], audit,
    result: {
      document_type: 'hospital_bill', provider_name: 'Metropolitan Medical Center', total_billed: 3650, amount_patient_owes: 1825.5, due_date: '2026-11-01',
      line_items: [
        { cpt_code: '99285', original_description: 'ER VISIT LVL 5', plain_description: 'Emergency room visit', billed_amount: 2450, date_of_service: '2026-09-14', source_page: 1, possible_issues: [] },
        { cpt_code: '70450', original_description: 'CT HEAD W/O CONTRAST', plain_description: 'Head CT scan', billed_amount: 300, date_of_service: '2026-09-14', source_page: 2, possible_issues: ['Listed twice on the same day.'] },
        { cpt_code: null, original_description: 'MED SUPPLIES', plain_description: 'Supplies', billed_amount: null, date_of_service: null, source_page: null, possible_issues: [] },
      ],
      plain_summary: 'You went to the emergency room.', spoken_summary: 'You went to the emergency room.', questions_to_ask: ['Can I get an itemized bill?'],
    },
  };
}

function analyzed(res = response()): BillCase {
  const base = { ...createManualCase(page(1), 'case-1'), attachments: [page(1), page(2)] };
  const mapped = mapGeminiAnalysis(res, base, 'en');
  return { ...base, provider: mapped.provider ?? '', serviceDate: mapped.serviceDate ?? '', lineItems: mapped.lineItems, extraction: mapped.extraction };
}

const bench = (code: string, rate: number | null, setting: string | null): BackendBenchmark =>
  ({ cpt_code: code, medicare_rate: rate, medicare_description: null, setting, source: 'local_csv', error: null });

test('the camera mapping keeps the saved id, notes by line, cents and pages, with a unique label per line', () => {
  const billCase = analyzed();
  assert.equal(billCase.extraction?.auditId, '00000000-0000-4000-8000-000000000001');
  assert.deepEqual(billCase.extraction?.notes, { 'gemini-line-2': ['Listed twice on the same day.'] });
  assert.deepEqual(billCase.lineItems.map(line => [line.code, line.billedCents, line.evidence.attachmentId]),
    [['99285', 245000, 'page-1'], ['70450', 30000, 'page-2'], [undefined, 0, 'page-1']]);
  assert.equal(billCase.provider, 'Metropolitan Medical Center');
  // The finding screen finds a finding's line by its evidence label, and one page can hold many lines.
  assert.equal(new Set(billCase.lineItems.map(line => line.evidence.label.en)).size, 3);
});

test('an unsaved analysis has no audit id, so nothing offers to replay it', () => {
  assert.equal(analyzed(response({ saved: false, audit_id: null, error: 'Saving is not configured.' })).extraction?.auditId, undefined);
  assert.equal(analyzed(response(null)).extraction?.auditId, undefined);
});

test('codes are normalised like the backend, and unknown rates give no comparison (never zero)', () => {
  assert.equal(normalizeCode(' 70450-'), '70450');
  assert.equal(normalizeCode('12'), undefined);
  const line = analyzed().lineItems[0];
  assert.equal(comparisonFor(line, bench('99285', null, null), 'now'), null);
  assert.equal(comparisonFor(line, undefined, 'now'), null);
});

test('findings: Gemini notes, and lines above 3x Medicare, worded as questions with the facility caveat', () => {
  const findings = reviewFindings(analyzed(), new Map([['99285', bench('99285', 171.35, 'facility')], ['70450', bench('70450', 106.55, 'non-facility')]]), 'now');
  assert.deepEqual(findings.map(finding => finding.id), ['price-gemini-line-1', 'note-gemini-line-2']);
  const [price, note] = findings;
  assert.match(price.title.en, /about 14 times Medicare's rate/);
  assert.match(price.explanation.en, /doctor's part/);
  assert.match(price.explanation.en, /not proof of an error/);
  assert.equal(price.comparison?.amountCents, 17135);
  assert.equal(price.label, 'worth_asking');
  assert.equal(note.label, 'needs_clarification');
  assert.equal(note.title.en, 'Listed twice on the same day.');
  assert.equal(note.evidence[0].attachmentId, 'page-2');
  // $300 against $106.55 is 2.8x: below the threshold, so no price question for the CT line.
  assert.ok(!findings.some(finding => finding.id === 'price-gemini-line-2'));
});

test('a rate covers every unit of a line', () => {
  const line = { ...analyzed().lineItems[1], units: 3 };
  assert.equal(comparisonFor(line, bench('70450', 106.55, 'non-facility'), 'now')?.amountCents, 31965);
});
