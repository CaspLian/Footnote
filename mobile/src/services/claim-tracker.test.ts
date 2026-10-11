import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { createManualCase } from '../domain/fixtures';
process.env.EXPO_PUBLIC_API_URL='http://backend.test';
let claimTracker: typeof import('./claim-tracker').claimTracker;
before(async()=>{ ({claimTracker}=await import('./claim-tracker')); });
test('claims record positive described coded lines in dollars, omit unknown totals, and keep saved analysis',async()=>{
  const c=createManualCase(undefined,'test','2026-10-10T00:00:00Z'); c.provider='Test Clinic';c.serviceDate='2026-09-01';c.financials={};const evidence={attachmentId:'a',page:1,label:{en:'Line',es:'Line'},excerpt:{en:'',es:''}}; c.lineItems=[{id:'ok',description:{en:'Visit',es:'Visit'},code:'99285',date:'',units:1,billedCents:12345,evidence},{id:'no-code',description:{en:'Visit',es:'Visit'},date:'',units:1,billedCents:100,evidence},{id:'zero',description:{en:'Visit',es:'Visit'},code:'99285',date:'',units:1,billedCents:0,evidence}];c.extraction={model:'test',mock:true,documentType:'bill',summary:{en:'',es:''},questions:[],issues:[],parsedAt:'now',auditId:'a',dueDate:'Sept 3'};
  let body:Record<string,unknown>={};globalThis.fetch=(async(_url,init)=>{body=JSON.parse(String(init?.body));return Response.json({audit_id:'claim'});}) as typeof fetch;assert.equal(await claimTracker.record(c),'claim');assert.deepEqual(body.items,[{code:'99285',description:'Visit',amount:123.45}]);assert.equal('total_billed' in body,false);assert.equal('payment_due_date' in body,false);assert.equal(body.analysis_audit_id,'a');c.extraction.dueDate='2026-12-01';c.financials.billedCents=12345;await claimTracker.record(c);assert.equal(body.payment_due_date,'2026-12-01');assert.equal(body.total_billed,123.45);
});
