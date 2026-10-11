import { describe, expect, it } from 'vitest';
import { displayDate, toConnectedCase } from './analysis-mapping';
import { analysisFixture } from './test-fixtures';

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
    expect(connected.discrepancy_amount).toBe(0);
    expect([connected.insurer_paid, connected.insurer_adjustments, connected.patient_paid, connected.eob_responsibility]).toEqual([0, 0, 0, 0]);
    for (const finding of connected.findings) {
      expect(finding.potential_savings).toBe(0);
      expect(finding.statutory_rule).toBeUndefined();
    }
    const everything = JSON.stringify(connected).toLowerCase();
    for (const claim of ['overcharg', 'you do not owe', 'illegal', 'fraud', 'no surprises act']) expect(everything).not.toContain(claim);
  });

  it('turns lines above the Medicare range into findings, the furthest first', () => {
    expect(connected.findings.map(f => [f.cpt_code, f.severity, f.category])).toEqual([
      ['70450', 'high', 'benchmark_outlier'],
      ['99284', 'high', 'benchmark_outlier'],
    ]);
    const [first] = connected.findings;
    expect(first.title).toBe("A scan of your head: billed about 30.2× Medicare's national rate");
    expect(first.title_es).toBe('A scan of your head: facturado a cerca de 30.2 veces la tarifa nacional de Medicare');
    expect(first.summary).toContain('not proof of an error');
    expect(first.evidence_quote).toBe('CT HEAD W/O CONTRAST: $3,200.00 billed | Medicare national rate: $106.03 (code 70450)');
    expect(first.explanation).toContain("Medicare's rate here covers only the doctor's fee.");
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
    expect(connected.dispute_letter_draft).toContain('To: Metropolitan Medical Center · Billing Department');
    expect(connected.dispute_letter_draft).toContain("- A scan of your head: billed about 30.2× Medicare's national rate");
    expect(connected.dispute_letter_draft_es).toContain('ASUNTO: Solicitud de factura detallada');
    expect(connected.call_script.split('\n')).toEqual([
      "Hi, I'm calling about my bill from Metropolitan Medical Center for services on Sep 18, 2026. I have a few questions:",
      '',
      '1. Can you explain the charge for A scan of your head (code 70450) and send me an itemized statement?',
      '2. Can you explain the charge for Emergency room visit (code 99284) and send me an itemized statement?',
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
    expect(eob.total_billed).toBe(4490); // the lines add up to it
    expect(eob.eob_responsibility).toBe(120);
    expect(eob.dispute_letter_recipient).toBe('insurer');
    expect(eob.audit_id).toBeNull();
    expect(eob.findings).toEqual([]);
    expect(eob.id).toBe(`case-${TODAY.getTime()}`);
  });
});

describe('displayDate', () => {
  it('writes dates as the sample cases do', () => {
    expect(displayDate('2026-09-02')).toBe('Sep 02, 2026');
    expect(displayDate(null)).toBe('');
    expect(displayDate('next week')).toBe('');
  });
});
