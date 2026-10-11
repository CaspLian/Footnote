import assert from 'node:assert/strict';
import test from 'node:test';
import type { BackendVoiceCatalog } from './backend';
import { resolveVoiceKey } from './voice-catalog';
const catalog: BackendVoiceCatalog = { default: 'matilda', language_defaults: { 'en-GB': 'alice', es: 'elio', zh: 'andy', hi: 'saavi' }, voices: ['matilda', 'alice', 'george', 'elio', 'andy', 'saavi'].map(key => ({ key, name: key, description: '', accent: '', gender: '' })) };
test('Calm follows exact locale, language and default voice rules', () => {
  for (const [locale, expected] of [['en-US','matilda'], ['en-GB','alice'], ['EN-gb','alice'], ['es-ES','elio'], ['zh-TW','andy'], ['hi-IN','saavi']]) assert.equal(resolveVoiceKey('calm', locale, catalog), expected);
});
test('legacy device means Calm; Clear and Warm map to catalog voices', () => { assert.equal(resolveVoiceKey('device','zh-TW',catalog),'andy'); assert.equal(resolveVoiceKey('clear','es-ES',catalog),'alice'); assert.equal(resolveVoiceKey('warm','en-US',catalog),'george'); });
test('a missing mapped slot falls back to the language default', () => { assert.equal(resolveVoiceKey('warm','zh-TW',{...catalog, voices:catalog.voices.filter(v=>v.key!=='george')}),'andy'); });
