import assert from 'node:assert/strict';
import test from 'node:test';
import { createManualCase } from '../domain/fixtures';
import type { DocumentAttachment } from '../domain/types';
import type { BackendAnalysis, BackendBenchmark } from './backend';
import { casePatchFromAnalysis, comparisonFor, normalizeCode, reviewFindings } from './backend-mapping';

const attachment: DocumentAttachment = {
  id: 'att-1', uri: 'file:///bill.pdf', name: 'bill.pdf', mimeType: 'application/pdf', kind: 'bill', origin: 'import', importedAt: '2026-10-10T12:00:00Z',
};

// The shape POST /api/v1/analyze returns (synthetic values).
function analysis(overrides: Partial<BackendAnalysis['result']> = {}): BackendAnalysis {
  return {
    target_language: 'en', model: 'gemini-3.5-flash', mock: false,
    result: {
      document_type: 'hospital_bill', provider_name: 'Metropolitan Medical Center', total_billed: 3650, amount_patient_owes: 1825.5, due_date: '2026-11-01',
      line_items: [
        { cpt_code: '99285', original_description: 'ER VISIT LVL 5', plain_description: 'Emergency room visit', billed_amount: 2450, date_of_service: '2026-09-14', possible_issues: [] },
        { cpt_code: '70450', original_description: 'CT HEAD W/O CONTRAST', plain_description: 'Head CT scan', billed_amount: 300, date_of_service: '2026-09-14', possible_issues: ['Listed twice on the same day.'] },
        { cpt_code: null, original_description: 'MED SUPPLIES', plain_description: 'Supplies', billed_amount: null, date_of_service: null, possible_issues: [] },
      ],
      plain_summary: 'You went to the emergency room.', spoken_summary: 'You went to the emergency room.', questions_to_ask: ['Can I get an itemized bill?'],
      ...overrides,
    },
    audit: { saved: true, audit_id: '00000000-0000-4000-8000-000000000001', error: null },
  };
}

const bench = (code: string, rate: number | null, setting: string | null): BackendBenchmark =>
  ({ cpt_code: code, medicare_rate: rate, medicare_description: null, setting, source: 'local_csv', error: null });

test('an analysis becomes entries the user checks: cents, codes, dates, and nothing invented', () => {
  const patch = casePatchFromAnalysis(createManualCase(attachment, 'case-1'), attachment, analysis(), 'en', '2026-10-10T12:00:01Z');
  assert.equal(patch.provider, 'Metropolitan Medical Center');
  assert.equal(patch.serviceDate, '2026-09-14');
  assert.deepEqual(patch.lineItems.map(line => [line.code, line.billedCents, line.date, line.units]),
    [['99285', 245000, '2026-09-14', 1], ['70450', 30000, '2026-09-14', 1], [undefined, 0, '2026-09-14', 1]]);
  assert.equal(patch.financials.billedCents, 365000);
  assert.equal(patch.financials.remainingCents, 182550);
  assert.equal(patch.financials.eobResponsibilityCents, undefined);
  assert.equal(patch.analysis?.auditId, '00000000-0000-4000-8000-000000000001');
  assert.deepEqual(patch.analysis?.notes, { 'att-1-line-2': ['Listed twice on the same day.'] });
  // Each line's evidence label is unique: the finding screen finds a finding's line by it.
  assert.equal(new Set(patch.lineItems.map(line => line.evidence.label.en)).size, 3);
});

test('an EOB fills the EOB amounts, not the statement balance', () => {
  const eob = { ...attachment, kind: 'eob' as const };
  const patch = casePatchFromAnalysis(createManualCase(eob, 'case-1'), eob, analysis({ document_type: 'eob' }), 'en', 'now');
  assert.equal(patch.financials.eobResponsibilityCents, 182550);
  assert.equal(patch.financials.eobBilledCents, 365000);
  assert.equal(patch.financials.remainingCents, 0);
});

test('an unsaved analysis has no audit id, so nothing offers to replay it', () => {
  const unsaved = { ...analysis(), audit: { saved: false, audit_id: null, error: 'Saving is not configured.' } };
  assert.equal(casePatchFromAnalysis(createManualCase(attachment, 'c'), attachment, unsaved, 'en', 'now').analysis?.auditId, undefined);
});

test('codes are normalised like the backend, and unknown rates give no comparison (never zero)', () => {
  assert.equal(normalizeCode(' 70450-'), '70450');
  assert.equal(normalizeCode('12'), undefined);
  const line = casePatchFromAnalysis(createManualCase(attachment, 'c'), attachment, analysis(), 'en', 'now').lineItems[0];
  assert.equal(comparisonFor(line, bench('99285', null, null), 'now'), null);
  assert.equal(comparisonFor(line, undefined, 'now'), null);
});

test('findings: Gemini notes, and lines above 3x Medicare, worded as questions with the facility caveat', () => {
  const patch = casePatchFromAnalysis(createManualCase(attachment, 'case-1'), attachment, analysis(), 'en', 'now');
  const billCase = { ...createManualCase(attachment, 'case-1'), ...patch };
  const findings = reviewFindings(billCase, new Map([['99285', bench('99285', 171.35, 'facility')], ['70450', bench('70450', 106.55, 'non-facility')]]), 'now');
  assert.deepEqual(findings.map(finding => finding.id), ['price-att-1-line-1', 'note-att-1-line-2']);
  const [price, note] = findings;
  assert.match(price.title.en, /about 14 times Medicare's rate/);
  assert.match(price.explanation.en, /doctor's part/);
  assert.match(price.explanation.en, /not proof of an error/);
  assert.equal(price.comparison?.amountCents, 17135);
  assert.equal(price.label, 'worth_asking');
  assert.equal(note.label, 'needs_clarification');
  assert.equal(note.title.en, 'Listed twice on the same day.');
  // $300 against $106.55 is 2.8x: below the threshold, so no price question for the CT line.
  assert.ok(!findings.some(finding => finding.id === 'price-att-1-line-2'));
});

test('a rate covers every unit of a line', () => {
  const patch = casePatchFromAnalysis(createManualCase(attachment, 'c'), attachment, analysis(), 'en', 'now');
  const line = { ...patch.lineItems[1], units: 3 };
  assert.equal(comparisonFor(line, bench('70450', 106.55, 'non-facility'), 'now')?.amountCents, 31965);
});
