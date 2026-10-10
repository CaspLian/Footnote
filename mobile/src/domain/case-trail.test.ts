import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createManualCase } from './fixtures';
import { caseTrail, caseNextAction } from './case-trail';
import type { CaseEvent, CaseStatus } from './types';
test('trail advances only with recorded state and returns to verification after edits', () => {
  const c = createManualCase(undefined, 'case', '2026-10-10T12:00:00Z');
  const events: CaseEvent[] = [{ id: 'e', caseId: c.id, kind: 'submitted', at: '2026-10-10T13:00:00Z' }];
  for (const [status, current] of [['needs_details', 1], ['ready', 2], ['action_prepared', 3], ['submitted', 4], ['resolved', 5]] as [CaseStatus, number][]) {
    const trail = caseTrail({ ...c, status }, events);
    assert.equal(trail.filter(s => s.state === 'complete').length, current);
    assert.equal(trail.filter(s => s.state === 'current').length, current === 5 ? 0 : 1);
  }
  const trail = caseTrail({ ...c, status: 'needs_details' }, events);
  assert.equal(trail[3].state, 'upcoming');
  assert.equal(caseNextAction({ ...c, status: 'needs_details' }).route, '/verify');
  assert.equal(caseNextAction({ ...c, status: 'action_prepared' }).route, '/draft');
  assert.equal(caseTrail(c, [{ ...events[0], caseId: 'different', kind: 'imported' }])[0].at, undefined);
});
