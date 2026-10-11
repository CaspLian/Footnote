// The event mapper drives the real controller through the callbacks used by the SDK.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentController, type AgentAdapter, type AgentContext, type AgentConnectOptions } from './voice-agent';
import { createAgentEventMapper, CALL_DROPPED_TEXT, CALL_LIMIT_TEXT } from './agent-events';

const context: AgentContext = { language: 'en', agentLanguage: 'en', voice: 'calm', evidence: [], preferences: { explanationDepth: 'simple', goal: 'understand' } };

function harness(streamAgentText = true) {
  const timers: { fn: () => void; ms: number }[] = [];
  let mapper!: ReturnType<typeof createAgentEventMapper>;
  let connects = 0; let ends = 0;
  const adapter: AgentAdapter = {
    async connect(_c, options: AgentConnectOptions) {
      connects++;
      mapper = createAgentEventMapper({ status: options.onStatus, message: options.onMessage, end: e => options.onEnd?.(e), interruption: options.onInterruption }, {
        streamAgentText, setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length - 1; }, clearTimer: h => { const t = timers[h as number]; if (t) t.fn = () => {}; },
      });
      mapper.callbacks.onStatusChange({ status: 'connecting' });
      mapper.callbacks.onStatusChange({ status: 'connected' });
      return { async end() { ends++; mapper.closeQuietly(); mapper.callbacks.onDisconnect({ reason: 'user' }); }, async setMuted() {}, levels: () => ({ input: .2, output: .7 }) };
    },
  };
  const controller = new AgentController(adapter);
  return { controller, cb: () => mapper.callbacks, mapper: () => mapper, timers, counts: () => ({ connects, ends }) };
}

test('greeting: connected is listening, speech shows the final text as the caption', async () => {
  const h = harness();
  await h.controller.start(context);
  assert.equal(h.controller.getSnapshot().status, 'listening');
  h.cb().onModeChange({ mode: 'speaking' });
  h.cb().onMessage({ role: 'agent', message: 'Hi! What would you like to know about your bill?', event_id: 1 });
  const s = h.controller.getSnapshot();
  assert.equal(s.status, 'speaking');
  assert.equal(s.caption?.text, 'Hi! What would you like to know about your bill?');
  assert.equal(s.caption?.final, true);
  assert.equal(h.controller.levels().output, .7);
});

test('a reply that finished before its text arrived never reappears under the orb in the next reply', async () => {
  const h = harness(false);
  await h.controller.start(context);
  h.cb().onModeChange({ mode: 'speaking' });
  h.cb().onModeChange({ mode: 'listening' });                                   // short reply: audio already over
  h.cb().onMessage({ role: 'agent', message: 'late text for turn 1', event_id: 2 }); // its text arrives late
  assert.equal(h.controller.getSnapshot().caption, undefined, 'cleared, because its audio is over');
  assert.equal(h.controller.getSnapshot().messages.at(-1)?.text, 'late text for turn 1', 'but kept in the transcript');
  h.cb().onModeChange({ mode: 'speaking' });                                    // the agent prompts again
  assert.equal(h.controller.getSnapshot().caption, undefined, 'no stale caption (the probe showed one without the rule)');
});

test('text that arrives before its own audio is kept for that audio', async () => {
  const h = harness(false);
  await h.controller.start(context);
  h.cb().onMessage({ role: 'agent', message: 'Hi there.', event_id: 1 });       // greeting text before its audio
  h.cb().onModeChange({ mode: 'speaking' });
  assert.equal(h.controller.getSnapshot().caption?.text, 'Hi there.');
  h.cb().onModeChange({ mode: 'listening' });
  h.cb().onMessage({ role: 'user', message: 'What is the biggest charge?', event_id: 3 });
  assert.equal(h.controller.getSnapshot().status, 'thinking');
  h.cb().onMessage({ role: 'agent', message: 'The head CT scan.', event_id: 4 }); // reply text before its audio
  h.cb().onModeChange({ mode: 'speaking' });
  assert.equal(h.controller.getSnapshot().caption?.text, 'The head CT scan.');
});

test('a streaming stop after audio ends preserves the late-caption guard', async () => {
  const h = harness(true);
  await h.controller.start(context);
  h.cb().onAgentChatResponsePart({ type: 'start', text: '', event_id: 1 });
  h.cb().onModeChange({ mode: 'speaking' });
  h.cb().onAgentChatResponsePart({ type: 'delta', text: 'Short reply.', event_id: 1 });
  h.cb().onModeChange({ mode: 'listening' });
  h.cb().onAgentChatResponsePart({ type: 'stop', text: '', event_id: 1 });
  h.cb().onMessage({ role: 'agent', message: 'Short reply.', event_id: 1 });
  assert.equal(h.controller.getSnapshot().caption, undefined);
  h.cb().onModeChange({ mode: 'speaking' });
  assert.equal(h.controller.getSnapshot().caption, undefined);
  await h.controller.end();
});

test('the person speaks: their words join the transcript, the orb thinks, and falls back to listening after 12 s', async () => {
  const h = harness();
  await h.controller.start(context);
  h.cb().onMessage({ role: 'user', message: 'Why is the scan so expensive?', event_id: 5 });
  assert.equal(h.controller.getSnapshot().status, 'thinking');
  assert.deepEqual(h.controller.getSnapshot().messages.map(m => [m.role, m.id, m.final]), [['user', 'user-1', true]]);
  assert.equal(h.timers.at(-1)?.ms, 12_000);
  h.timers.at(-1)!.fn();
  assert.equal(h.controller.getSnapshot().status, 'listening');
});

test('streamed words grow one caption; the final text replaces it under the same id; a tool call starts a new turn', async () => {
  const h = harness(true);
  await h.controller.start(context);
  h.cb().onMessage({ role: 'user', message: 'What is the biggest charge?', event_id: 1 });
  h.cb().onAgentChatResponsePart({ type: 'start', text: '', event_id: 2 });
  h.cb().onAgentChatResponsePart({ type: 'delta', text: 'The biggest charge ', event_id: 2 });
  assert.equal(h.controller.getSnapshot().status, 'thinking', 'text streams before its audio');
  h.cb().onModeChange({ mode: 'speaking' });
  h.cb().onAgentChatResponsePart({ type: 'delta', text: 'is the head CT scan.', event_id: 2 });
  let s = h.controller.getSnapshot();
  assert.equal(s.caption?.text, 'The biggest charge is the head CT scan.');
  assert.equal(s.caption?.final, false);
  h.cb().onAgentChatResponsePart({ type: 'stop', text: '', event_id: 2 });
  h.cb().onMessage({ role: 'agent', message: 'The biggest charge is the head CT scan.', event_id: 2 });
  h.cb().onMessage({ role: 'agent', message: 'It is about 30 times Medicareâ€™s rate.', event_id: 3 }); // after a client tool call
  s = h.controller.getSnapshot();
  assert.deepEqual(s.messages.map(m => [m.role, m.id, m.final]), [['user', 'user-1', true], ['agent', 'agent-2', true], ['agent', 'agent-3', true]]);
  assert.equal(s.caption?.id, 'agent-3');
});

test('an interruption stops the caption, and the correction replaces what was not said', async () => {
  const h = harness(false);
  await h.controller.start(context);
  h.cb().onModeChange({ mode: 'speaking' });
  h.cb().onMessage({ role: 'agent', message: 'Let me explain every line of the bill, starting with the scan.', event_id: 4 });
  h.cb().onInterruption();
  h.cb().onModeChange({ mode: 'listening' });
  assert.equal(h.controller.getSnapshot().caption, undefined);
  h.cb().onAgentResponseCorrection({ original_agent_response: 'Let me explain every line of the bill, starting with the scan.', corrected_agent_response: 'Let me explain every line', event_id: 4 });
  const s = h.controller.getSnapshot();
  assert.equal(s.messages.length, 1);
  assert.equal(s.messages[0].text, 'Let me explain every line');
  assert.equal(s.caption, undefined, 'a correction is never shown under the orb');
});

test('the helper says goodbye: idle, the transcript stays, and Start works again (the probe gap is closed)', async () => {
  const h = harness();
  await h.controller.start(context);
  h.cb().onModeChange({ mode: 'speaking' });
  h.cb().onMessage({ role: 'agent', message: 'Goodbye!', event_id: 9 });
  h.cb().onDisconnect({ reason: 'agent', context: { type: 'end_call', reason: 'Agent ended the call' } });
  let s = h.controller.getSnapshot();
  assert.equal(s.status, 'idle'); assert.equal(s.error, undefined); assert.equal(s.messages.length, 1);
  await h.controller.toggleMuted();
  assert.equal(h.controller.getSnapshot().muted, false, 'no session left to mute');
  await h.controller.start(context);
  s = h.controller.getSnapshot();
  assert.equal(h.counts().connects, 2); assert.equal(s.status, 'listening');
});

test('a dropped call and the time limit show their own message and allow a retry', async () => {
  const h = harness();
  await h.controller.start(context);
  h.cb().onDisconnect({ reason: 'error', message: 'LiveKit connection state changed to disconnected', context: { type: 'connection_state_changed' } });
  assert.equal(h.controller.getSnapshot().status, 'error');
  assert.equal(h.controller.getSnapshot().error, CALL_DROPPED_TEXT);
  await h.controller.start(context);
  h.cb().onDisconnect({ reason: 'error', message: 'max', context: { type: 'max_duration_exceeded' } });
  assert.equal(h.controller.getSnapshot().error, CALL_LIMIT_TEXT);
  assert.equal(h.counts().connects, 2);
});

test('End conversation reports nothing twice, and nothing is applied after the end', async () => {
  const h = harness();
  await h.controller.start(context);
  await h.controller.end();
  assert.equal(h.counts().ends, 1);
  const before = h.controller.getSnapshot();
  h.cb().onModeChange({ mode: 'speaking' });
  h.cb().onMessage({ role: 'agent', message: 'stale', event_id: 1 });
  h.cb().onDisconnect({ reason: 'error', message: 'x', context: { type: 'close' } });
  assert.equal(h.controller.getSnapshot(), before);
});

test('another player taking the audio ends the call as a normal end', async () => {
  const h = harness();
  await h.controller.start(context);
  h.mapper().reportEnd();
  assert.equal(h.controller.getSnapshot().status, 'idle');
  assert.equal(h.controller.getSnapshot().error, undefined);
  await h.controller.start(context);
  assert.equal(h.counts().connects, 2);
});

test('a far-end hang-up while still connecting: the late session is ended once and the orb stays idle', async () => {
  let resolve!: () => void; let ends = 0;
  let options!: AgentConnectOptions;
  const controller = new AgentController({ connect(_c, o) { options = o; return new Promise(r => { resolve = () => r({ async end() { ends++; }, async setMuted() {} }); }); } });
  const run = controller.start(context);
  options.onEnd?.({ error: CALL_DROPPED_TEXT });
  assert.equal(controller.getSnapshot().status, 'error');
  resolve(); await run;
  assert.equal(ends, 1);
  assert.equal(controller.getSnapshot().status, 'error');
});


test('provider interruptions update the controller once and ignore events after End', async () => {
  const h = harness();
  await h.controller.start(context);
  h.cb().onModeChange({ mode: 'speaking' });
  h.cb().onInterruption();
  assert.equal(h.controller.getSnapshot().interruptions, 1);
  assert.equal(h.controller.getSnapshot().status, 'listening');
  await h.controller.end();
  h.cb().onInterruption();
  assert.equal(h.controller.getSnapshot().interruptions, 1);
});
