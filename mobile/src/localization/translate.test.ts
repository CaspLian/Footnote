import test from 'node:test';
import assert from 'node:assert/strict';
import { translateText } from './translate';
import { workingLanguages } from '../domain/languages';
test('Chinese and Japanese Guide placeholders use distinct local copy',()=>{assert.equal(translateText('EOB, deductible, appeal…','zh-Hant'),'給付明細、自付額、申訴…');assert.equal(translateText('EOB, deductible, appeal…','ja'),'給付明細、免責金額、異議申し立て…');});
test('document confirmation and intake copy are bundled for every selected language',()=>{for(const {code} of workingLanguages.filter(l=>l.code!=='en'))for(const key of ['Use this document','Use these documents','Capture a clear bill or EOB.','Add a bill, an EOB, or both. We’ll use the evidence you have, and you can add more later.'])assert.notEqual(translateText(key,code),key,`${code}: ${key}`);});
