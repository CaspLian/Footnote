import { backendConfigured } from '../services/backend';
import { claimAudio } from '../services/audio-focus';
import { createElevenLabsConversation, type AgentDebugHook } from '../services/elevenlabs-conversation';
import { loadAgentSdk } from '../services/elevenlabs-sdk';
import { createVoiceAgentSessionAdapter } from '../services/voice-agent-session';
import { configureAgentAdapter, unavailableAgentAdapter } from '../services/voice-agent';
import { requestMicrophone } from './microphone';

/** Install after backend adapters; no backend means no SDK load, microphone or request. */
export function installLiveVoiceAgent() {
  if (!backendConfigured()) return;
  const enabled = process.env.EXPO_PUBLIC_VOICE_AGENT !== 'off';
  const conversation = createElevenLabsConversation({
    loadSdk: loadAgentSdk, requestMicrophone, claimAudio,
    devHook: hook => { if (__DEV__) (globalThis as typeof globalThis & { __unfoldAgent?: AgentDebugHook }).__unfoldAgent = hook; },
  });
  configureAgentAdapter(createVoiceAgentSessionAdapter({
    fallback: unavailableAgentAdapter,
    ...(enabled ? { prepare: conversation.prepare, open: conversation.open } : {}),
  }));
}
