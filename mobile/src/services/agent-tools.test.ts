import test from 'node:test';
import assert from 'node:assert/strict';
import { agentToolHandlers, clearAgentHighlight, highlightStore, parseLineNumber } from './agent-tools';
import type { AgentContext } from './voice-agent';
import type { AgentLine } from './voice-agent-session';

const context: AgentContext = {
  language: 'en', agentLanguage: 'en', voice: 'calm', evidence: [], preferences: { explanationDepth: 'simple', goal: 'understand' },
  case: { id: 'case1', provider: 'Sample', serviceDate: '2026-09-01', financials: {} as never, findings: ['note-gemini-line-1', 'price-gemini-line-1', 'price-gemini-line-2', 'price-gemini-line-3'].map(id => ({ id })) as never },
};
const lines: AgentLine[] = [{ number: 1, name: 'Sample scan', inContext: true }, { number: 2, name: 'Doctor portion', label: 'doctor_part_only', inContext: true }, { number: 3, name: 'Omitted line', inContext: false }];

test('tools highlight only valid findings belonging to the bill and included in agent context', () => {
  clearAgentHighlight(); const tools = agentToolHandlers(context, lines, () => 123);
  assert.equal(tools.show_line_item({ line_number: 1 }), 'Shown on screen.');
  assert.deepEqual(highlightStore.get(), { caseId: 'case1', findingId: 'note-gemini-line-1', lineNumber: 1, lineName: 'Sample scan', at: 123 });
  assert.equal(tools.show_price_check({ line_number: 1 }), 'Shown on screen.');
  assert.equal(highlightStore.get()?.findingId, 'price-gemini-line-1');
  assert.match(tools.show_price_check({ line_number: 2 }), /no card/);
  assert.match(tools.show_line_item({ line_number: 3 }), /not available/);
  assert.match(tools.show_line_item({ line_number: 9 }), /no line 9/);
  assert.equal(highlightStore.get()?.findingId, 'price-gemini-line-1');
  clearAgentHighlight(); assert.equal(highlightStore.get(), undefined);
});

test('line numbers reject coercion, fractions, negative values and unknown bill lines', () => {
  for (const value of ['1', 1.5, 0, -1, NaN, Infinity, 1000, undefined]) assert.equal(parseLineNumber({ line_number: value }), undefined);
  assert.equal(parseLineNumber({ line_number: 1 }), 1);
  assert.equal(parseLineNumber(null), undefined);
  assert.match(agentToolHandlers(context, []).show_line_item({ line_number: 1 }), /no line/);
});
