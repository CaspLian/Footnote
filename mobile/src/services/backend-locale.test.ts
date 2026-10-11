import assert from 'node:assert/strict';
import test from 'node:test';
import { workingLanguages } from '../domain/languages';
import { backendLocale } from './backend';

test('every working language is sent as a region locale the backend can resolve', () => {
  for (const { code } of workingLanguages) assert.match(backendLocale(code), /^[a-z]{2,3}-[A-Z]{2}$/, code);
  assert.equal(backendLocale('en'), 'en-US');
  assert.equal(backendLocale('zh-Hans'), 'zh-CN');
  assert.equal(backendLocale('zh-Hant'), 'zh-TW');
  assert.equal(backendLocale('pt-PT'), 'pt-PT');
  assert.equal(backendLocale('no'), 'nb-NO');
  assert.equal(backendLocale('he'), 'he-IL');
  assert.equal(backendLocale('th'), 'th-TH');
});
