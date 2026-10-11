import assert from 'node:assert/strict';
import test from 'node:test';
import type { BackendVoiceCatalog } from './backend';
import { accentFor, resolveVoiceKey, speaksLocale, voicesForLocale } from './voice-catalog';
const catalog: BackendVoiceCatalog = { default: 'matilda', language_defaults: { 'en-GB': 'alice', es: 'elio', zh: 'andy', hi: 'saavi' }, voices: ['matilda', 'alice', 'george', 'elio', 'andy', 'saavi'].map(key => ({ key, name: key, description: '', accent: '', gender: '', verified_languages: [{ language: key === 'elio' ? 'es' : key === 'andy' ? 'zh' : key === 'saavi' ? 'hi' : 'en' }] })) };
test('Calm follows exact locale, language and default voice rules', () => {
  for (const [locale, expected] of [['en-US','matilda'], ['en-GB','alice'], ['EN-gb','alice'], ['es-ES','elio'], ['zh-TW','andy'], ['hi-IN','saavi']]) assert.equal(resolveVoiceKey('calm', locale, catalog), expected);
});
test('legacy device means Calm; Clear and Warm map to catalog voices verified for the language', () => { assert.equal(resolveVoiceKey('device','zh-TW',catalog),'andy'); assert.equal(resolveVoiceKey('clear','en-GB',catalog),'alice'); assert.equal(resolveVoiceKey('warm','en-US',catalog),'george'); assert.equal(resolveVoiceKey('clear','es-ES',catalog),'elio'); });
test('a missing mapped slot falls back to the language default', () => { assert.equal(resolveVoiceKey('warm','zh-TW',{...catalog, voices:catalog.voices.filter(v=>v.key!=='george')}),'andy'); });


test('explicit provider names stay selected while missing provider voices recover to the locale default', () => {
  assert.equal(resolveVoiceKey('provider:george', 'en-AU', catalog), 'george');
  assert.equal(resolveVoiceKey('provider:removed', 'es-ES', catalog), 'elio');
  assert.equal(voicesForLocale('es-ES', catalog)[0].name, 'elio');
  assert.equal(voicesForLocale('zh-TW', catalog)[0].name, 'andy');
  assert.deepEqual(voicesForLocale('zh-TW', catalog).map(v => v.key), ['andy']);
  assert.deepEqual(voicesForLocale('es-ES', catalog).map(v => v.key), ['elio']);
  assert.equal(voicesForLocale('fr-FR', catalog).length, 0);
  assert.equal(voicesForLocale('en-US', {...catalog, voices:catalog.voices.map(({verified_languages,...v}) => v)}).length, 0);
});

test('a voice chosen for one language never reads another with a foreign accent', () => {
  // George speaks English only here: in Spanish the Spanish voice speaks, and the choice returns in English.
  assert.equal(resolveVoiceKey('provider:george', 'es-ES', catalog), 'elio');
  assert.equal(resolveVoiceKey('provider:george', 'en-US', catalog), 'george');
  const bilingual: BackendVoiceCatalog = { ...catalog, voices: catalog.voices.map(v => v.key === 'george' ? { ...v, verified_languages: [{ language: 'en' }, { language: 'es', locale: 'es-ES', accent: 'peninsular' }] } : v) };
  assert.equal(resolveVoiceKey('provider:george', 'es-ES', bilingual), 'george');
  assert.deepEqual(voicesForLocale('es-ES', bilingual).map(v => v.key), ['elio', 'george']);
  assert.equal(accentFor(bilingual.voices.find(v => v.key === 'george')!, 'es-ES'), 'Peninsular');
  // A configured default that is not verified for its language is skipped.
  assert.equal(resolveVoiceKey('calm', 'hi-IN', { ...catalog, language_defaults: { hi: 'george' } }), 'saavi');
});

test('Norwegian voices listed by ElevenLabs as "no" serve the nb-NO locale, and exact regional accents come first', () => {
  const nordic: BackendVoiceCatalog = { default: 'matilda', language_defaults: {}, voices: [
    { key: 'matilda', name: 'Matilda', description: '', accent: '', gender: '', verified_languages: [{ language: 'en' }] },
    { key: 'andy', name: 'Andy', description: '', accent: '', gender: '', verified_languages: [{ language: 'no', accent: 'no-standard' }] },
    { key: 'jeanne', name: 'Jeanne', description: '', accent: '', gender: '', verified_languages: [{ language: 'fr', locale: 'fr-CA', accent: 'quebec' }] },
    { key: 'claire', name: 'Claire', description: '', accent: '', gender: '', verified_languages: [{ language: 'fr', locale: 'fr-FR', accent: 'fr-standard' }] },
  ] };
  assert.deepEqual(voicesForLocale('nb-NO', nordic).map(v => v.key), ['andy']);
  assert.equal(resolveVoiceKey('calm', 'nb-NO', nordic), 'andy');
  assert.equal(accentFor(nordic.voices[1], 'nb-NO'), 'Standard');
  assert.deepEqual(voicesForLocale('fr-CA', { ...nordic, language_defaults: { fr: 'claire' } }).map(v => v.key), ['claire', 'jeanne']);
  assert.deepEqual(voicesForLocale('fr-CA', { ...nordic, language_defaults: { 'fr-CA': 'jeanne' } }).map(v => v.key), ['jeanne', 'claire']);
  assert.equal(speaksLocale({ key: 'x', name: 'X', description: '', accent: '', gender: '' }, 'en-US'), true);
  assert.equal(speaksLocale({ key: 'x', name: 'X', description: '', accent: '', gender: '' }, 'ja-JP'), false);
});
