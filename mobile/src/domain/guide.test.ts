import test from 'node:test';
import assert from 'node:assert/strict';
import { searchGlossary } from './glossary';
import { guideExplanationService } from '../services/guide-explanations';
import { createSampleCase } from './fixtures';
import { selectBills } from './bill-list';
test('Guide searches abbreviations, definitions, accented text and empty queries', () => {
  assert.equal(searchGlossary(' EOB ', 'en')[0].id, 'eob');
  assert.equal(searchGlossary('coinsurance', 'en')[0].id, 'coinsurance');
  assert.equal(searchGlossary('deducible', 'es')[0].id, 'deductible');
  assert.equal(searchGlossary('xyz-no-match', 'en').length, 0); assert.equal(searchGlossary('', 'en').length, 8);
});
test('Guide listening contract preserves the source and keeps placeholder voices separate from content', async () => {
  const simple = await guideExplanationService.prepare({ termId: 'eob', language: 'en', depth: 'simple', voice: 'warm' });
  const detailed = await guideExplanationService.prepare({ termId: 'eob', language: 'en', depth: 'detailed', voice: 'device' });
  assert.equal(simple.provenance, 'curated_local'); assert.ok(simple.source.url.startsWith('https://www.cms.gov/'));
  assert.ok(!simple.narration.includes(simple.example)); assert.ok(detailed.narration.includes(detailed.example)); assert.ok(detailed.narration.includes(detailed.question));
  await assert.rejects(guideExplanationService.prepare({ termId: 'missing', language: 'en', depth: 'simple', voice: 'device' }));
});
test('Bills search, sorting and resolved visibility are applied without changing the saved cases', () => {
  const first = { ...createSampleCase('a'), provider: 'Café Clinic', updatedAt: '2026-10-01', followUpDate: '2026-10-20' };
  const second = { ...createSampleCase('b'), provider: 'Dental', status: 'resolved' as const, updatedAt: '2026-10-09', followUpDate: '2026-10-15' };
  const third = { ...createSampleCase('c'), provider: 'Optical', updatedAt: '2026-10-05', financials: { ...first.financials, remainingCents: 100000 } };
  const cases = [first, second, third];
  assert.deepEqual(selectBills(cases, [], { showResolved: true, billSort: 'recent' }, '').map(c => c.id), ['b', 'c', 'a']);
  assert.deepEqual(selectBills(cases, [], { showResolved: false, billSort: 'balance' }, '').map(c => c.id), ['c', 'a']);
  assert.deepEqual(selectBills(cases, [], { showResolved: true, billSort: 'follow_up' }, '').map(c => c.id), ['b', 'a', 'c']);
  assert.equal(selectBills(cases, [], { showResolved: true, billSort: 'recent' }, 'cafe')[0].id, 'a'); assert.equal(cases[0].id, 'a');
});
