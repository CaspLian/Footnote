import assert from 'node:assert/strict';
import test from 'node:test';
import { workingLanguages } from '../domain/languages';
import { backendLocale } from './backend';

test('every working language is sent as a region locale the backend can resolve', () => {
  // Keep in sync with backend/locales.py. A well-formed tag alone is not enough to prove the server accepts it.
  const supported = new Set('en-US en-GB en-AU en-CA ja-JP zh-CN de-DE hi-IN fr-FR fr-CA ko-KR pt-BR pt-PT it-IT es-ES es-MX id-ID nl-NL tr-TR fil-PH pl-PL sv-SE bg-BG ro-RO ar-SA ar-AE cs-CZ el-GR fi-FI hr-HR ms-MY sk-SK da-DK ta-IN uk-UA ru-RU hu-HU nb-NO vi-VN zh-TW he-IL th-TH'.split(' '));
  assert.equal(supported.size, 42);
  for (const { code } of workingLanguages) assert.ok(supported.has(backendLocale(code)), code);
  for (const { code } of workingLanguages) assert.match(backendLocale(code), /^[a-z]{2,3}-[A-Z]{2}$/, code);
  assert.equal(backendLocale('en'), 'en-US');
  assert.equal(backendLocale('zh-Hans'), 'zh-CN');
  assert.equal(backendLocale('zh-Hant'), 'zh-TW');
  assert.equal(backendLocale('pt-PT'), 'pt-PT');
  assert.equal(backendLocale('no'), 'nb-NO');
  assert.equal(backendLocale('he'), 'he-IL');
  assert.equal(backendLocale('th'), 'th-TH');
});
