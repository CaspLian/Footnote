import { describe, expect, it } from 'vitest';
import { displayDate, toConnectedCase } from './analysis-mapping';
import { analysisFixture } from './test-fixtures';
import { claimFromCase } from './cases';

const FILES = [{ name: 'statement.jpg', size: 1_468_006 }, { name: 'page-2.jpg', size: 900_000 }];
const TODAY = new Date(2026, 9, 10);

describe('toConnectedCase', () => {
  const connected = toConnectedCase(analysisFixture(), FILES, 'en', TODAY);

  it('keeps what the bill says', () => {
    expect(connected.provider_name).toBe('Metropolitan Medical Center');
    expect(connected.facility_type).toBe('Hospital bill');
    expect(connected.service_date).toBe('Sep 18, 2026');
    expect(connected.total_billed).toBe(4490);
    expect(connected.statement_balance).toBe(4490);
    expect(connected.audio_summary_script).toBe(analysisFixture().result.spoken_summary);
    expect(connected.audit_id).toBe('5b3c8f0e-1c6e-4d2a-9a77-3f1e2d4c5b6a');
    expect(connected.analysis_language).toBe('en-GB');
    expect(connected.documents.map(d => [d.name, d.type, d.size, d.uploadDate])).toEqual([
      ['statement.jpg', 'bill', '1.4 MB', 'Oct 10, 2026'],
      ['page-2.jpg', 'bill', '879 KB', 'Oct 10, 2026'],
    ]);
  });

  it('never makes up savings, discrepancies, statutes or insurer payments', () => {
    expect(connected.discrepancy_amount).toBeNull();
    expect([connected.insurer_paid, connected.insurer_adjustments, connected.patient_paid, connected.eob_responsibility]).toEqual([null, null, null, null]);
    for (const finding of connected.findings) {
      expect(finding.potential_savings).toBeNull();
      expect(finding.statutory_rule).toBeUndefined();
    }
    const everything = JSON.stringify(connected).toLowerCase();
    for (const claim of ['overcharg', 'you do not owe', 'illegal', 'fraud', 'no surprises act']) expect(everything).not.toContain(claim);
  });

  it('keeps doctor-only references as clarification questions after comparable price findings', () => {
    expect(connected.findings.map(f => [f.cpt_code, f.severity, f.category])).toEqual([
      ['99284', 'high', 'benchmark_outlier'],
      ['70450', 'info', 'benchmark_outlier'],
    ]);
    const first = connected.findings.find(f => f.cpt_code === '70450')!;
    expect(first.title).toBe("A scan of your head: clarify the doctor's fee");
    expect(first.title_es).toBe('A scan of your head: aclarar el honorario médico');
    expect(first.summary).toContain("not the hospital's full charge");
    expect(first.evidence_quote).toBe('CT HEAD W/O CONTRAST: $3,200.00 billed | Medicare national rate: $106.03 (code 70450)');
    expect(first.explanation).toContain("covers only the doctor's fee");
    expect(first.explanation).not.toContain("times");
  });

  it('flags lines by price or by what Gemini noticed, with the reason', () => {
    expect(connected.line_items.map(item => [item.cpt_code, item.status, item.benchmark_allowed])).toEqual([
      ['70450', 'flagged', 106.03],
      ['99284', 'flagged', 118.82],
      ['80053', 'clean', 10.56],
    ]);
    expect(connected.line_items[1].flag_reason).toBe("The visit level is not explained. Billed about 10.1× Medicare's national rate.");
  });

  it('writes the letter and the call script from the findings and Gemini\'s questions', () => {
    expect(connected.dispute_letter_recipient).toBe('billing');
    expect(connected.dispute_letter_draft).toContain('To: Metropolitan Medical Center — Billing Department');
    expect(connected.dispute_letter_draft).toContain("- A scan of your head: clarify the doctor's fee");
    expect(connected.dispute_letter_draft_es).toContain('ASUNTO: Solicitud de factura detallada');
    expect(connected.call_script.split('\n')).toEqual([
      "Hi, I'm calling about my bill from Metropolitan Medical Center for services on Sep 18, 2026. I have a few questions:",
      '',
      '1. Can you explain the charge for Emergency room visit (code 99284) and send me an itemized statement?',
      '2. Can you explain the charge for A scan of your head (code 70450) and send me an itemized statement?',
      '3. Can you send me an itemized bill?',
      '4. Was my insurance billed?',
    ]);
  });

  it('copes with what Gemini could not read, an EOB, and an analysis that was not saved', () => {
    const sparse = analysisFixture({ audit: { saved: false, audit_id: null, error: 'Not saved' }, price_checks: [] });
    sparse.result = { ...sparse.result, document_type: 'eob', provider_name: null, total_billed: null, amount_patient_owes: 120,
      line_items: sparse.result.line_items.map(item => ({ ...item, date_of_service: null })) };
    const eob = toConnectedCase(sparse, [], 'es', TODAY);
    expect(eob.provider_name).toBe('Proveedor desconocido');
    expect(eob.facility_type).toBe('Explicación de beneficios');
    expect(eob.service_date).toBe('');
    expect(eob.total_billed).toBeNull(); // not explicitly stated in the document
    expect(eob.eob_responsibility).toBe(120);
    expect(eob.dispute_letter_recipient).toBe('insurer');
    expect(eob.audit_id).toBeNull();
    expect(eob.findings).toEqual([]);
    expect(eob.id).toBe(`case-${TODAY.getTime()}`);
  });

  it('does not infer a patient balance from a billed total or unknown payments', () => {
    const response = analysisFixture();
    response.result.amount_patient_owes = null;
    const bill = toConnectedCase(response, [], 'en');
    expect(bill.total_billed).toBe(4490);
    expect(bill.statement_balance).toBeNull();
    expect(bill.derived_remaining).toBeNull();
    expect(bill.discrepancy_amount).toBeNull();
  });

  it('preserves missing charges and excludes them from confirmed claim amounts', () => {
    const response = analysisFixture({ price_checks: [] });
    response.result = { ...response.result, total_billed: null, amount_patient_owes: null,
      line_items: response.result.line_items.map((item, index) => ({ ...item, billed_amount: index === 0 ? null : 0 })) };
    const bill = toConnectedCase(response, [], 'en');
    expect(bill.line_items.map(item => item.hospital_amount)).toEqual([null, 0, 0]);
    expect(bill.line_items.every(item => item.benchmark_allowed === null)).toBe(true);
    expect(claimFromCase(bill).items.map(item => [item.code, item.amount])).toEqual([['99284', 0], ['80053', 0]]);
    expect(claimFromCase(bill)).not.toHaveProperty('total_billed');
  });
});

describe('displayDate', () => {
  it('formats extracted service dates', () => {
    expect(displayDate('2026-09-02')).toBe('Sep 02, 2026');
    expect(displayDate(null)).toBe('');
    expect(displayDate('next week')).toBe('');
  });
});
