import test from 'node:test';
import assert from 'node:assert/strict';
import { createManualCase } from './fixtures';
import { needsDocumentProcessing } from './document-readiness';
import type { ExtractedAnalysis } from './types';

const extracted:ExtractedAnalysis={model:'synthetic-test',mock:false,documentType:'bill',summary:{en:'Read',es:'Read'},questions:[],issues:[],parsedAt:'2026-10-11',processedAttachmentIds:['a']};
function imported(){const c=createManualCase();c.attachments=[{id:'a',uri:'file:///a.pdf',name:'a.pdf',kind:'auto',mimeType:'application/pdf',origin:'import',importedAt:'2026-10-11'}];return c;}
test('unread imported documents cannot enter verification, even with manually filled amounts',()=>{const c=imported();c.provider='Entered';c.financials={remainingCents:100};assert.equal(needsDocumentProcessing(c),true);c.extraction={...extracted,mock:true};assert.equal(needsDocumentProcessing(c),true);});
test('processed file set covers every current import, independent of uncertain document classification',()=>{const c=imported();c.extraction=extracted;assert.equal(needsDocumentProcessing(c),false);c.attachments.push({...c.attachments[0],id:'b'});assert.equal(needsDocumentProcessing(c),true);c.extraction={...extracted,processedAttachmentIds:['a','b']};assert.equal(needsDocumentProcessing(c),false);});
test('legacy real extraction and explicit manual cases remain usable',()=>{const c=imported();c.extraction={...extracted,processedAttachmentIds:undefined};assert.equal(needsDocumentProcessing(c),false);assert.equal(needsDocumentProcessing(createManualCase()),false);});
