import test from 'node:test';
import assert from 'node:assert/strict';
import { createManualCase } from './fixtures';
import { mapGeminiAnalysis, type GeminiAnalyzeResponse } from './extraction';
import { validateCase } from './review';
import { comparisonFor, priceFinding } from '../services/backend-mapping';

const response: GeminiAnalyzeResponse = {
  model: 'test-model', mock: true, target_language: 'en',
  result: { document_type: 'hospital_bill', provider_name: 'North Hospital', total_billed: 125.5, amount_patient_owes: 40, due_date: null,
    line_items: [{ cpt_code: '99284', original_description: 'Emergency visit', plain_description: 'Emergency visit', billed_amount: 125.5, date_of_service: '2026-09-18', source_page: 1, possible_issues: ['Confirm the duplicate fee.'] }],
    plain_summary: 'A test bill.', spoken_summary: 'A test bill.', questions_to_ask: ['What is this fee?'] },
  price_checks: [],
};

test('Gemini result maps extracted amounts and source evidence into the review case', () => {
  const billCase = createManualCase({ id: 'photo-1', uri: 'file:///bill.jpg', name: 'bill.jpg', mimeType: 'image/jpeg', kind: 'bill', origin: 'import', importedAt: '2026-09-18T00:00:00Z' }, 'case-1');
  const mapped = mapGeminiAnalysis(response, billCase, 'en');
  assert.equal(mapped.provider, 'North Hospital');
  assert.equal(mapped.serviceDate, '2026-09-18');
  assert.equal(mapped.financials.billedCents, 12550);
  assert.equal(mapped.financials.remainingCents, 4000);
  assert.equal(mapped.lineItems[0].evidence.attachmentId, 'photo-1');
  assert.equal(mapped.findings[0].explanation.en, 'Confirm the duplicate fee.');
  assert.equal(mapped.extraction.mock, true);
});

test('missing extracted money stays unknown instead of becoming zero', () => {
  const billCase = createManualCase();
  const mapped = mapGeminiAnalysis({ ...response, result: { ...response.result, total_billed: null, amount_patient_owes: null } }, billCase, 'en');
  assert.deepEqual(mapped.financials, {});
});

test('a missing line amount is explicitly unknown, blocks verification and cannot produce a zero-dollar comparison',()=>{const billCase=createManualCase();const mapped=mapGeminiAnalysis({...response,result:{...response.result,line_items:[{...response.result.line_items[0],billed_amount:null}]}},billCase,'en');const line=mapped.lineItems[0];assert.equal(line.amountMissing,true);assert.ok(validateCase({...billCase,...mapped}).some(issue=>issue.field===`${line.id}.billedCents`&&issue.key==='required'));const benchmark={cpt_code:'99284',medicare_rate:100,medicare_description:'Visit',setting:'facility',source:'csv',error:null};assert.equal(comparisonFor(line,benchmark,'now'),null);assert.equal(priceFinding(line,{source:'CMS',url:'https://cms.gov',amountCents:10000,retrievedAt:'now',context:{en:'Reference',es:'Reference'}}),null);const zero=mapGeminiAnalysis({...response,result:{...response.result,line_items:[{...response.result.line_items[0],billed_amount:0}]}},billCase,'en').lineItems[0];assert.equal(zero.amountMissing,false,'an explicitly stated zero is distinct from a missing value');});
