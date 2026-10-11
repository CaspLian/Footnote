import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraAccessState } from './camera-access';

test('camera startup waits for the native result instead of reporting access is off', () => {
  assert.equal(cameraAccessState(null, false), 'checking');
  assert.equal(cameraAccessState({ status: 'undetermined', granted: false }, true), 'checking');
  assert.equal(cameraAccessState({ status: 'granted', granted: true }, false), 'granted');
});

test('returning from Settings hides the stale denial while refreshing then accepts the grant', () => {
  const denied = { status: 'denied', granted: false };
  assert.equal(cameraAccessState(denied, false), 'needs-permission');
  assert.equal(cameraAccessState(denied, true), 'checking');
  assert.equal(cameraAccessState({ status: 'granted', granted: true }, false), 'granted');
});
