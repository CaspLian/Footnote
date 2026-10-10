import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrollEdgeOpacity } from './scroll-edges';
test('scroll softening clears at either edge and on non-scrolling content', () => {
  assert.deepEqual(scrollEdgeOpacity(0, 1000, 600), { top: 0, bottom: 1 });
  assert.deepEqual(scrollEdgeOpacity(400, 1000, 600), { top: 1, bottom: 0 });
  assert.deepEqual(scrollEdgeOpacity(200, 1000, 600), { top: 1, bottom: 1 });
  assert.deepEqual(scrollEdgeOpacity(0, 500, 600), { top: 0, bottom: 0 });
  assert.deepEqual(scrollEdgeOpacity(0, 1000, 0), { top: 0, bottom: 0 });
});
test('adjusted native insets, bounce and resized content do not leave a stale fade', () => {
  assert.deepEqual(scrollEdgeOpacity(-64, 1000, 600, 64, 34), { top: 0, bottom: 1 });
  assert.deepEqual(scrollEdgeOpacity(434, 1000, 600, 64, 34), { top: 1, bottom: 0 });
  assert.deepEqual(scrollEdgeOpacity(-90, 1000, 600, 64, 34), { top: 0, bottom: 1 });
  assert.deepEqual(scrollEdgeOpacity(600, 400, 600), { top: 0, bottom: 0 });
  assert.deepEqual(scrollEdgeOpacity(12, 1000, 600), { top: .5, bottom: 1 });
});
