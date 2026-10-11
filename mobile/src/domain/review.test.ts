import assert from 'node:assert/strict';
import test from 'node:test';
import { createManualCase, createSampleCase } from './fixtures';
import { expectedRemaining, formatMoney, isISODate, isMoney, parseMoney } from './money';
import { getCaseSummary, validateCase } from './review';
import { glossary, searchGlossary } from './glossary';
import { benchmarkService, buildDraft, documentService } from '../services/local-services';
import type { DocumentAttachment } from './types';

test('sample statement and EOB are separate, coherent cents ledgers', () => {
  const c = createSampleCase(); const f = c.financials;
  assert.ok(isMoney(f.billedCents)&&isMoney(f.adjustmentCents)&&isMoney(f.postAdjustmentCents)&&isMoney(f.patientPaidCents));
  assert.equal(c.lineItems.reduce((sum, line) => sum + line.billedCents, 0), f.billedCents);
  assert.equal(f.billedCents - f.adjustmentCents, f.postAdjustmentCents);
  assert.equal(f.postAdjustmentCents - f.insurerPaidCents! - f.patientPaidCents, f.remainingCents);
  assert.equal(f.allowedCents! - f.insurerPaidCents!, f.eobResponsibilityCents);
  assert.equal(expectedRemaining(f), 24400);
  assert.notEqual(f.postAdjustmentCents, f.allowedCents);
  assert.equal(formatMoney(f.remainingCents, 'en'), '$494.00');
  assert.equal(validateCase(c).length, 0);
});

test('money input rejects nonfinite, negative, fractional-cent and malformed amounts', () => {
  assert.equal(parseMoney('$1,234.56'), 123456);
  assert.equal(parseMoney('0.01', 'es'), 1);
  assert.equal(parseMoney('1234.5'), 123450);
  for (const value of ['', '-1', 'NaN', 'Infinity', '1e3', '1.001', '1,2', '1.234,56', '90071992547409999']) assert.equal(parseMoney(value), null, value);
  assert.equal(formatMoney(Number.NaN), 'Not shown');
  assert.equal(isISODate('2026-02-30'), false);
  assert.equal(isISODate('2028-02-29'), true);
});

test('sample produces evidence-linked clarification questions with no benchmark or guaranteed savings', async () => {
  const c = createSampleCase(); const result = await documentService.processBill(c);
  assert.equal(result.mode, 'synthetic'); assert.equal(result.findings.length, 2);
  for (const finding of result.findings) {
    assert.equal(finding.label, 'needs_clarification');
    assert.ok(finding.evidence.every(e => c.attachments.some(a => a.id === e.attachmentId)));
    assert.equal(finding.comparison, undefined);
  }
  assert.equal(await benchmarkService.lookup(c.lineItems[0]), null);
  assert.match(result.summary.en, /\$494\.00/); assert.match(result.summary.es, /\$244\.00/);
});

test('edited confirmed amounts recalculate questions while original source excerpts stay fixed', async () => {
  const c = createSampleCase(); c.financials.remainingCents = 24400;
  let result = await documentService.processBill(c);
  assert.equal(result.findings.some(f => f.id === 'balance-reconciliation'), false);
  c.financials.remainingCents = 40000;
  result = await documentService.processBill(c);
  const finding = result.findings.find(f => f.id === 'balance-reconciliation')!;
  assert.match(finding.explanation.en, /confirmed entries.*\$400\.00/);
  assert.match(finding.evidence[0].excerpt.en, /\$494\.00/);
  assert.match(result.summary.en, /^Based on your confirmed entries:/);
});

test('manual imports and missing/reclassified sample EOBs cannot receive seeded findings', async () => {
  const attachment: DocumentAttachment = { id: 'northline-eob', uri: 'file:///arbitrary.pdf', name: 'Arbitrary.pdf', mimeType: 'application/pdf', kind: 'eob', origin: 'import', importedAt: new Date().toISOString() };
  const manual = createManualCase(attachment); manual.provider = 'A provider'; manual.serviceDate = '2026-09-18'; manual.financials.remainingCents = 90000;
  const result = await documentService.processBill(manual);
  assert.equal(result.mode, 'manual'); assert.deepEqual(result.findings, []); assert.match(getCaseSummary(manual, 'es'), /manualmente/);
  const sample = createSampleCase(); sample.attachments[1] = attachment;
  const missingSampleSource = await documentService.processBill(sample);
  assert.deepEqual(missingSampleSource.findings, []);
  assert.match(missingSampleSource.summary.en, /entered manually/);
  sample.attachments[1] = { ...createSampleCase().attachments[1], kind: 'policy' };
  assert.deepEqual((await documentService.processBill(sample)).findings, []);
});

test('Gemini extraction summary remains the review summary for imported cases', () => {
  const manual = createManualCase();
  manual.extraction = {
    model: 'gemini-test', mock: false, documentType: 'hospital bill',
    summary: { en: 'The bill asks for $125.00.', es: 'La factura solicita $125.00.' },
    questions: [], issues: [], parsedAt: new Date().toISOString(),
  };
  assert.equal(getCaseSummary(manual, 'en'), 'The bill asks for $125.00.');
  assert.match(getCaseSummary(manual, 'es'), /La factura solicita/);
});

test('billing correction and insurer appeal templates do not invent a denial', async () => {
  const c = createSampleCase(); c.findings = (await documentService.processBill(c)).findings;
  const correction = buildDraft(c, 'billing_correction', 'en');
  assert.match(correction, /CPT 80053/); assert.match(correction, /\$244\.00/); assert.doesNotMatch(correction, /guaranteed|refund owed/i);
  const appeal = buildDraft(c, 'insurer_appeal', 'en');
  assert.match(appeal, /\[Describe the denied benefit/); assert.match(appeal, /Do not infer a denial from this bill/);
  assert.match(buildDraft(c, 'insurer_appeal', 'es'), /No infieras una denegación a partir de esta factura/);
});

test('eight bilingual glossary terms have usable primary-source links and accent-insensitive search', () => {
  assert.equal(glossary.length, 8);
  for (const term of glossary) { assert.ok(term.title.en && term.title.es && term.definition.en && term.definition.es); assert.match(term.source.url, /^https:\/\/(www\.)?(cms\.gov|healthcare\.gov)\//); }
  assert.equal(searchGlossary('apelacion', 'es')[0].id, 'appeal');
});
