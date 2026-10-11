import test from 'node:test';
import assert from 'node:assert/strict';
import type { PartialOptions } from '@elevenlabs/client';
import { AgentController, AgentUnavailable, type AgentContext } from './voice-agent';
import { createElevenLabsConversation, MICROPHONE_TEXT, NOT_IN_BUILD_TEXT, privacyNoticeStore, type AgentSdk, type SdkConversation } from './elevenlabs-conversation';
import type { AgentSessionGrant } from './voice-agent-session';
import { highlightStore } from './agent-tools';

const context: AgentContext = {
  language: 'en', agentLanguage: 'en', voice: 'calm', evidence: [], preferences: { explanationDepth: 'simple', goal: 'understand' },
  case: { id: 'case1', provider: 'Sample provider', serviceDate: '2026-09-01', financials: {} as never, findings: [{ id: 'note-gemini-line-1' }] as never },
};
const grant: AgentSessionGrant = {
  connectionType: 'webrtc', conversationToken: 'synthetic-token', startWithinSeconds: 600, userId: 'synthetic-user',
  dynamicVariables: { bill_loaded: 'yes' }, overrides: { agent: { language: 'en' } }, clientTools: ['show_line_item', 'show_price_check'],
  lines: [{ number: 1, name: 'Sample scan', inContext: true }], privacyNotice: 'Sample bills only: synthetic privacy notice.',
};
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

function harness(hold = false, timeout = 30_000) {
  const calls: string[] = [];
  let sdkOptions!: PartialOptions;
  let resolveStart!: (conversation: SdkConversation) => void;
  let endCount = 0;
  let releaseCount = 0;
  let stopAudio!: () => void;
  const conversation: SdkConversation = {
    type: 'voice', async endSession() { endCount++; }, setMicMuted(muted) { calls.push(`mute:${muted}`); },
    getInputVolume: () => .1, getOutputVolume: () => .8, sendUserMessage(text) { calls.push(`message:${text}`); }, getId: () => 'synthetic-conversation',
  };
  const sdk: AgentSdk = { Conversation: { startSession(options) {
    calls.push('start'); sdkOptions = options;
    return hold ? new Promise(resolve => { resolveStart = resolve; }) : Promise.resolve(conversation);
  } } };
  const client = createElevenLabsConversation({
    loadSdk: async () => { calls.push('load'); return sdk; },
    requestMicrophone: async () => { calls.push('microphone'); return 'granted'; },
    activateMicrophone: async () => { calls.push('duplex'); },
    claimAudio(holder) { calls.push('claim'); stopAudio = holder.stop; return () => { releaseCount++; }; }, connectTimeoutMs: timeout,
  });
  const controller = new AgentController({ async connect(value, options) { const prepared = await client.prepare(value, options.signal); return client.open(grant, value, options, prepared); } });
  return { client, sdk, controller, calls, options: () => sdkOptions, resolve: () => resolveStart(conversation), stopAudio: () => stopAudio(), ends: () => endCount, releases: () => releaseCount };
}

test('voice startup uses a WebRTC ticket, both validated tools, SDK controls and one audio owner', async () => {
  const h = harness(); await h.controller.start(context);
  assert.deepEqual(h.calls, ['load', 'microphone', 'claim', 'duplex', 'start', 'duplex', 'mute:false']);
  const options = h.options();
  assert.equal(options.conversationToken, grant.conversationToken);
  assert.equal(options.connectionType, 'webrtc');
  assert.equal('signedUrl' in options || 'textOnly' in options, false);
  assert.deepEqual(Object.keys(options.clientTools ?? {}).sort(), ['show_line_item', 'show_price_check']);
  assert.equal(privacyNoticeStore.get(), grant.privacyNotice);
  await h.controller.toggleMuted(); assert.ok(h.calls.includes('mute:true'));
  await h.controller.toggleMuted(); assert.deepEqual(h.calls.slice(-2),['duplex','mute:false']);
  assert.deepEqual(h.controller.levels(), { input: .1, output: .8 });
  await h.controller.end(); await h.controller.end();
  assert.equal(h.ends(), 1); assert.equal(h.releases(), 1);
});

test('missing SDK and refused microphone stop before ticket creation', async () => {
  let requests = 0;
  const missing = createElevenLabsConversation({ loadSdk: async () => { throw new Error('native missing'); }, requestMicrophone: async () => { requests++; return 'granted'; } });
  await assert.rejects(missing.prepare(context, new AbortController().signal), error => error instanceof AgentUnavailable && error.message === NOT_IN_BUILD_TEXT);
  assert.equal(requests, 0);
  for (const microphone of ['denied', 'insecure', 'no_device'] as const) {
    const refused = createElevenLabsConversation({ loadSdk: async () => harness().sdk, requestMicrophone: async () => microphone });
    await assert.rejects(refused.prepare(context, new AbortController().signal), error => error instanceof AgentUnavailable && error.message === MICROPHONE_TEXT[microphone]);
  }
});

test('ending during SDK startup disposes late connection once and ignores its captions/tools', async () => {
  const h = harness(true); const run = h.controller.start(context); await tick();
  await h.controller.end(); await run;
  assert.equal(h.releases(), 1); assert.equal(h.ends(), 0);
  h.options().onMessage?.({ role: 'agent', source: 'ai', message: 'Late caption' });
  assert.equal(h.controller.getSnapshot().messages.length, 0);
  assert.equal(await h.options().clientTools?.show_line_item({ line_number: 1 }), 'The conversation has ended.');
  h.resolve(); await tick(); assert.equal(h.ends(), 1);
});

test('startup timeout releases audio immediately, then closes an eventual connection once', async () => {
  const h = harness(true, 5); await h.controller.start(context);
  assert.equal(h.controller.getSnapshot().status, 'error'); assert.equal(h.releases(), 1);
  h.resolve(); await tick(); assert.equal(h.ends(), 1);
});

test('remote hang-up releases microphone state, audio and highlights, preserves transcript, and allows Start', async () => {
  const h = harness(); await h.controller.start(context);
  h.options().onMessage?.({ role: 'agent', source: 'ai', message: 'Goodbye!' });
  await h.options().clientTools?.show_line_item({ line_number: 1 });
  assert.equal(highlightStore.get()?.caseId, 'case1');
  h.options().onDisconnect?.({ reason: 'agent', context: { type: 'end_call' } });
  assert.equal(h.controller.getSnapshot().status, 'idle');
  assert.equal(h.controller.getSnapshot().messages[0].text, 'Goodbye!');
  assert.equal(highlightStore.get(), undefined); assert.equal(h.releases(), 1);
  await h.controller.start(context); assert.equal(h.calls.filter(call => call === 'start').length, 2);
  await h.controller.end();
});

test('remote hang-up before startSession resolves closes its late audio connection', async () => {
  const h = harness(true); const run = h.controller.start(context); await tick();
  h.options().onDisconnect?.({ reason: 'agent', context: { type: 'end_call' } });
  await run; assert.equal(h.controller.getSnapshot().status, 'idle'); assert.equal(h.releases(), 1);
  h.resolve(); await tick(); assert.equal(h.ends(), 1);
});

test('another player claiming audio ends an established conversation once', async () => {
  const h = harness(); await h.controller.start(context); h.stopAudio(); await tick();
  assert.equal(h.controller.getSnapshot().status, 'idle'); assert.equal(h.ends(), 1); assert.equal(h.releases(), 1);
});

test('a synchronous SDK failure also releases audio', async () => {
  const h = harness(); h.sdk.Conversation.startSession = () => { throw new Error('startup failed'); };
  await h.controller.start(context); assert.equal(h.controller.getSnapshot().status, 'error'); assert.equal(h.releases(), 1);
});

test('microphone unmute failures are surfaced and close the call instead of showing Listening',async()=>{
  const h=harness();await h.controller.start(context);
  h.options().onError?.('Failed to set input muted state',new Error('synthetic recording failure'));
  await tick();assert.equal(h.controller.getSnapshot().status,'error');assert.match(h.controller.getSnapshot().error??'',/Microphone control failed/);assert.equal(h.ends(),1);
});
