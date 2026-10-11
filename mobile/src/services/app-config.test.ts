import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('development builds declare microphone access and LiveKit setup without plugin permission removals', () => {
  const { expo } = JSON.parse(readFileSync(fileURLToPath(new URL('../../app.json', import.meta.url)), 'utf8'));
  const plugins = new Map<string, Record<string, unknown>>(expo.plugins.map((plugin: string | [string, Record<string, unknown>]) => typeof plugin === 'string' ? [plugin, {}] : plugin));
  for (const options of plugins.values()) {
    assert.notEqual(options.microphonePermission, false);
    assert.notEqual(options.recordAudioAndroid, false);
  }
  assert.ok(plugins.has('@livekit/react-native-expo-plugin'));
  assert.equal(typeof plugins.get('@config-plugins/react-native-webrtc')?.microphonePermission, 'string');
  assert.equal(typeof plugins.get('expo-audio')?.microphonePermission, 'string');
  assert.ok(expo.android.permissions.includes('android.permission.RECORD_AUDIO'));
});
