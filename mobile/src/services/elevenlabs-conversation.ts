import { throwIfAborted } from './abort-signal';
import type { PartialOptions, SessionConfig } from '@elevenlabs/client';
import { AgentUnavailable, type AgentConnectOptions, type AgentContext, type AgentSession } from './voice-agent';
import type { AgentSessionGrant } from './voice-agent-session';
import { createAgentEventMapper } from './agent-events';
import { agentToolHandlers, clearAgentHighlight, CLIENT_TOOL_NAMES } from './agent-tools';

/** Platform-independent SDK slice; implementations are loaded only by the platform entry. */
export interface SdkConversation {
  readonly type: 'voice' | 'text';
  endSession(): Promise<void>;
  setMicMuted(muted: boolean): void;
  getInputVolume(): number;
  getOutputVolume(): number;
  sendUserMessage(text: string): void;
  getId(): string;
}
export interface AgentSdk { Conversation: { startSession(options: PartialOptions): Promise<SdkConversation> } }
export type MicrophoneAccess = 'granted' | 'denied' | 'insecure' | 'no_device';
export interface AgentDebugHook { send(text: string): void; id(): string }
export interface ElevenLabsDeps {
  loadSdk(): Promise<AgentSdk>;
  requestMicrophone(): Promise<MicrophoneAccess>;
  claimAudio?(holder: { stop(): void }): () => void;
  connectTimeoutMs?: number;
  streamAgentText?: boolean;
  devHook?(hook: AgentDebugHook | undefined): void;
  log?(event: string, detail?: Record<string, string | number | boolean>): void;
}

export const NOT_IN_BUILD_TEXT = 'This version of the app doesn’t include live voice yet. Install the latest development build.';
export const MICROPHONE_TEXT: Record<Exclude<MicrophoneAccess, 'granted'>, string> = {
  denied: 'Footnote needs the microphone to talk it through. Allow microphone access for Footnote in your device settings, then try again.',
  insecure: 'The microphone only works on a secure page. Open Footnote at http://localhost or over HTTPS.',
  no_device: 'No microphone was found. Connect one, then try again.',
};
export const DEFAULT_PRIVACY_NOTICE = "The bill details and everything said in this call go to ElevenLabs, which uses Google's Gemini, and ElevenLabs keeps them for 7 days.";
let notice = DEFAULT_PRIVACY_NOTICE;
const noticeListeners = new Set<() => void>();
export const privacyNoticeStore = {
  get: () => notice,
  subscribe(listener: () => void) { noticeListeners.add(listener); return () => { noticeListeners.delete(listener); }; },
  set(next: string | undefined) { if (next && next !== notice) { notice = next; noticeListeners.forEach(listener => listener()); } },
};

const abortError = () => Object.assign(new Error('Aborted'), { name: 'AbortError' });
const isMicrophoneError = (error: unknown) => {
  const name = (error as { name?: string } | null)?.name;
  return name === 'NotAllowedError' || name === 'SecurityError' || /permission denied/i.test(String((error as Error)?.message ?? ''));
};

export function createElevenLabsConversation(deps: ElevenLabsDeps) {
  return {
    async prepare(_context: AgentContext, signal: AbortSignal): Promise<{ sdk: AgentSdk }> {
      throwIfAborted(signal);
      let sdk: AgentSdk;
      try { sdk = await deps.loadSdk(); } catch { throwIfAborted(signal); throw new AgentUnavailable(NOT_IN_BUILD_TEXT); }
      throwIfAborted(signal);
      const mic = await deps.requestMicrophone();
      throwIfAborted(signal);
      if (mic !== 'granted') throw new AgentUnavailable(MICROPHONE_TEXT[mic]);
      return { sdk };
    },

    async open(grant: AgentSessionGrant, context: AgentContext, options: AgentConnectOptions, { sdk }: { sdk: AgentSdk }): Promise<AgentSession> {
      const { signal } = options;
      throwIfAborted(signal);
      if (grant.connectionType !== 'webrtc' || !grant.conversationToken) throw new Error('A WebRTC conversation token is required.');
      privacyNoticeStore.set(grant.privacyNotice);
      let conversation: SdkConversation | undefined;
      let closed = false;
      let cleaned = false;
      let release = () => {};
      let closing: Promise<void> | undefined;
      const closeSdk = (value: SdkConversation) => closing ??= Promise.resolve().then(() => value.endSession());
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true; release(); clearAgentHighlight(); deps.devHook?.(undefined);
      };
      let resolveEnded!: () => void;
      const ended = new Promise<void>(resolve => { resolveEnded = resolve; });
      const events = createAgentEventMapper({
        status: options.onStatus,
        message: options.onMessage,
        end: ending => { closed = true; cleanup(); resolveEnded(); options.onEnd?.(ending); },
      }, { streamAgentText: deps.streamAgentText, log: deps.log });
      release = deps.claimAudio?.({ stop: () => {
        if (closed) return;
        events.reportEnd();
        if (conversation) void closeSdk(conversation).catch(() => {});
      } }) ?? (() => {});
      if (closed) release();

      let started: Promise<SdkConversation> | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let onAbort: (() => void) | undefined;
      try {
        if (closed) throw abortError();
        throwIfAborted(signal);
        const handlers = agentToolHandlers(context, grant.lines);
        const clientTools = Object.fromEntries(CLIENT_TOOL_NAMES.map(name => [name, (params: unknown) => closed ? 'The conversation has ended.' : handlers[name](params)]));
        started = sdk.Conversation.startSession({
          conversationToken: grant.conversationToken,
          connectionType: 'webrtc',
          dynamicVariables: grant.dynamicVariables,
          overrides: grant.overrides as NonNullable<SessionConfig['overrides']>,
          userId: grant.userId,
          clientTools,
          onUnhandledClientToolCall: call => deps.log?.('tool_unknown', { name: call.tool_name }),
          ...events.callbacks,
        });
        const cancelled = new Promise<never>((_resolve, reject) => {
          onAbort = () => reject(abortError());
          signal.addEventListener('abort', onAbort, { once: true });
          timer = setTimeout(() => reject(new Error('connect_timeout')), deps.connectTimeoutMs ?? 30_000);
          if (signal.aborted) onAbort();
        });
        conversation = await Promise.race([started, cancelled, ended.then(() => { throw abortError(); })]);
        throwIfAborted(signal);
        if (closed) throw abortError();
        if (conversation.type !== 'voice') throw new Error('not_a_voice_session');
      } catch (error) {
        closed = true; events.dispose(); cleanup();
        // SDK startup cannot be cancelled: dispose a connection that arrives after End or timeout.
        if (started) void started.then(closeSdk).catch(() => {});
        if (isMicrophoneError(error)) throw new AgentUnavailable(MICROPHONE_TEXT.denied);
        throw error;
      } finally {
        if (timer !== undefined) clearTimeout(timer);
        if (onAbort) signal.removeEventListener('abort', onAbort);
      }
      const activeConversation = conversation;
      deps.devHook?.({ send: text => { if (!closed) { events.userTyped(text); activeConversation.sendUserMessage(text); } }, id: () => activeConversation.getId() });
      return {
        async end() { if (closed) return; closed = true; events.closeQuietly(); cleanup(); await closeSdk(activeConversation); },
        async setMuted(muted) { if (!closed) activeConversation.setMicMuted(muted); },
        levels() {
          if (closed) return { input: 0, output: 0 };
          try { return { input: activeConversation.getInputVolume(), output: activeConversation.getOutputVolume() }; }
          catch { return { input: 0, output: 0 }; }
        },
      };
    },
  };
}
