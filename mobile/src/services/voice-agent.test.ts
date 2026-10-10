import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentController, AgentUnavailable, agentLanguage, type AgentContext, type AgentSession } from './voice-agent';
const context: AgentContext = { language:'zh-Hant',agentLanguage:'zh',voice:'calm',evidence:[{id:'eob',kind:'eob',name:'eob.pdf'}],preferences:{explanationDepth:'simple',goal:'understand'} };
test('live agent receives available evidence and regional languages map to the provider language',async()=>{
  let mute = false, ended = false;
  const controller = new AgentController({async connect(c,{onStatus,onMessage}){assert.deepEqual(c.evidence,context.evidence);onStatus('speaking');onMessage({role:'agent',text:'What would you like to understand?'});return {async end(){ended=true;},async setMuted(v){mute=v;}};}});
  await controller.start(context);assert.equal(controller.getSnapshot().status,'speaking');assert.equal(controller.getSnapshot().messages.length,1);await controller.toggleMuted();assert.equal(mute,true);await controller.end();assert.equal(ended,true);assert.equal(controller.getSnapshot().status,'idle');assert.equal(agentLanguage('pt-PT'),'pt');assert.equal(agentLanguage('zh-Hant'),'zh');
});
test('leaving during connection disposes a late session and ignores late provider callbacks',async()=>{
  let resolve!:(session:AgentSession)=>void;let ended=0;let lateStatus!:()=>void;
  const controller=new AgentController({connect(_,{onStatus}){lateStatus=()=>onStatus('speaking');return new Promise(r=>{resolve=r;});}});
  const run=controller.start(context);await controller.end();lateStatus();resolve({async end(){ended++;},async setMuted(){}});await run;assert.equal(ended,1);assert.equal(controller.getSnapshot().status,'idle');
});
test('missing live connection is explicit and retryable; it never substitutes device TTS',async()=>{
  let calls=0;const controller=new AgentController({async connect(){calls++;throw new AgentUnavailable('Not connected');}});await controller.start(context);assert.equal(controller.getSnapshot().status,'unavailable');assert.equal(controller.getSnapshot().error,'Not connected');await controller.start(context);assert.equal(calls,2);
});

test('streaming captions replace partial turns, keep final text, and clear between speaking turns', async () => {
  let callbacks!: Parameters<import('./voice-agent').AgentAdapter['connect']>[1];
  const controller = new AgentController({ async connect(_, options) { callbacks = options; return { async end() {}, async setMuted() {} }; } });
  await controller.start(context);
  callbacks.onStatus('speaking');
  callbacks.onMessage({ id: 'turn-1', role: 'agent', text: 'The statement', final: false });
  callbacks.onMessage({ id: 'turn-1', role: 'agent', text: 'The statement shows a patient balance.', final: true });
  callbacks.onMessage({ id: 'turn-1', role: 'agent', text: 'Late partial', final: false });
  assert.equal(controller.getSnapshot().messages.length, 1);
  assert.equal(controller.getSnapshot().caption?.text, 'The statement shows a patient balance.');
  callbacks.onStatus('listening');
  assert.equal(controller.getSnapshot().caption, undefined);
  callbacks.onStatus('speaking');
  callbacks.onMessage({ id: 'turn-2', role: 'agent', text: 'Let’s check the original document.' });
  assert.equal(controller.getSnapshot().caption?.id, 'turn-2');
  await controller.end();
  callbacks.onMessage({ id: 'turn-3', role: 'agent', text: 'Stale response' });
  assert.equal(controller.getSnapshot().caption, undefined);
  assert.equal(controller.getSnapshot().messages.length, 2);
});
