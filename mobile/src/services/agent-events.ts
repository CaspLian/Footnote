// Pure translation of the SDK's audio modes, streamed text and disconnects into the orb's state.
import type { Callbacks } from '@elevenlabs/client';
import type { AgentEnding, AgentMessage, AgentStatus } from './voice-agent';

type SdkStatus = 'disconnected' | 'connecting' | 'connected' | 'disconnecting';
type SdkMode = 'speaking' | 'listening';
type SdkDisconnect =
  | { reason: 'error'; message: string; context: { type: string; reason?: string; code?: number }; closeCode?: number; closeReason?: string }
  | { reason: 'agent'; context?: { type: string; reason?: string; code?: number }; closeCode?: number; closeReason?: string }
  | { reason: 'user' };

export interface AgentEventSink { status(status: AgentStatus): void; message(message: AgentMessage): void; end(ending: AgentEnding): void; interruption?(): void }
export interface AgentEventOptions {
  /** Show the agent's words while they stream (agent_chat_response_part). Off: captions come once per reply. */
  streamAgentText?: boolean;
  /** "Thinking" falls back to "Listening" when no reply starts within this time. */
  thinkingTimeoutMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  log?: (event: string, detail?: Record<string, string | number | boolean>) => void;
}
export const CALL_LIMIT_TEXT = 'This conversation reached its 10-minute limit. Start a new one to keep going.';
export const CALL_DROPPED_TEXT = 'The conversation was interrupted. Check your connection, then try again.';

export function createAgentEventMapper(sink: AgentEventSink, options: AgentEventOptions = {}) {
  const stream = options.streamAgentText ?? true;
  const thinkingMs = options.thinkingTimeoutMs ?? 12_000;
  const setTimer = options.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const log = options.log ?? (() => {});

  let mode: SdkMode = 'listening';
  let awaitingReply = false;              // the person finished a turn; no reply has started yet
  let speechEndedSinceAgentText = false;  // an agent speaking period ended after the last agent text arrived
  let open: { id: string; text: string } | undefined;      // the agent turn still being written
  let lastFinal: { id: string; text: string } | undefined; // for corrections after an interruption
  let count = 0;
  let thinkingTimer: unknown;
  let ended = false;
  let quiet = false;                       // the person (or the controller) ended the call: report nothing

  const listeningStatus = (): AgentStatus => (awaitingReply ? 'thinking' : 'listening');
  const stopThinking = () => { if (thinkingTimer !== undefined) { clearTimer(thinkingTimer); thinkingTimer = undefined; } };
  const startThinking = () => {
    stopThinking();
    thinkingTimer = setTimer(() => { thinkingTimer = undefined; if (!ended && awaitingReply && mode === 'listening') { awaitingReply = false; sink.status('listening'); } }, thinkingMs);
  };
  const userTurn = (text: string) => {
    if (ended || !text.trim()) return;
    sink.message({ role: 'user', id: `user-${++count}`, text, final: true });
    if (mode !== 'speaking') { awaitingReply = true; sink.status('thinking'); startThinking(); }
  };
  const finish = (ending: AgentEnding | undefined) => {
    if (ended) return;
    ended = true; stopThinking();
    if (!quiet && ending) sink.end(ending);
  };

  const callbacks = {
    onStatusChange({ status }: { status: SdkStatus }) {
      if (ended) return;
      if (status === 'connecting') sink.status('connecting');
      else if (status === 'connected' && mode !== 'speaking') sink.status(listeningStatus());
    },
    onModeChange({ mode: next }: { mode: SdkMode }) {
      if (ended) return;
      const wasSpeaking = mode === 'speaking';
      mode = next;
      if (next === 'speaking') { awaitingReply = false; stopThinking(); sink.status('speaking'); }
      else { if (wasSpeaking) speechEndedSinceAgentText = true; sink.status(listeningStatus()); if (awaitingReply) startThinking(); }
    },
    onMessage({ message, role }: { message: string; role: 'user' | 'agent'; event_id?: number }) {
      if (ended || !message.trim()) return;
      if (role === 'user') { userTurn(message); return; }
      const late = mode === 'listening' && !awaitingReply && speechEndedSinceAgentText;
      speechEndedSinceAgentText = false;
      const id = open?.id ?? `agent-${++count}`;
      open = undefined; lastFinal = { id, text: message };
      sink.message({ role: 'agent', id, text: message, final: true });
      // Its audio already finished: keep it in the transcript, but clear it from under the orb, or it would
      // reappear at the start of the next reply (Aarush's controller keeps the caption until a status clears it).
      if (late) sink.status(listeningStatus());
    },
    onAgentChatResponsePart({ text, type }: { text: string; type: 'start' | 'delta' | 'stop'; event_id: number }) {
      if (ended || !stream) return;
      if (type === 'stop') return;
      speechEndedSinceAgentText = false;
      open ??= { id: `agent-${++count}`, text: '' };
      if (type === 'delta') { open.text += text; if (open.text.trim()) sink.message({ role: 'agent', id: open.id, text: open.text, final: false }); }
    },
    onAgentResponseCorrection({ corrected_agent_response }: { original_agent_response: string; corrected_agent_response: string; event_id: number }) {
      if (ended || !lastFinal || !corrected_agent_response.trim()) return;
      lastFinal = { id: lastFinal.id, text: corrected_agent_response };
      sink.message({ role: 'agent', id: lastFinal.id, text: corrected_agent_response, final: true, corrected: true });
      if (mode === 'listening') sink.status(listeningStatus());
    },
    onInterruption() { if (!ended) { log('interruption'); mode = 'listening'; speechEndedSinceAgentText = true; sink.interruption?.(); sink.status(listeningStatus()); } },
    onDisconnect(details: SdkDisconnect) {
      log('disconnect', { reason: details.reason, type: 'context' in details && details.context ? details.context.type : '' });
      if (details.reason === 'user') return finish(quiet ? undefined : {});
      if (details.reason === 'agent') return finish({});
      return finish({ error: details.context?.type === 'max_duration_exceeded' ? CALL_LIMIT_TEXT : CALL_DROPPED_TEXT });
    },
    // Errors that matter end the call and arrive as onDisconnect; the rest (a failed tool, a mute that did not
    // apply) are logged only, never shown as a dropped call.
    onError(message: string) { log('sdk_error', { length: message.length }); },
  } satisfies Pick<Callbacks, 'onStatusChange' | 'onModeChange' | 'onMessage' | 'onAgentChatResponsePart' | 'onAgentResponseCorrection' | 'onInterruption' | 'onDisconnect' | 'onError'>;

  return {
    callbacks,
    /** A typed question (the dev hook, or a later "Type instead" field). Unverified: whether the server also echoes it as a transcript. */
    userTyped: userTurn,
    /** Before the controller's own end(): the controller already shows idle, so nothing is reported. */
    closeQuietly() { quiet = true; finish(undefined); },
    /** The adapter ended the call itself (another player took the audio): report a normal end. */
    reportEnd(ending: AgentEnding = {}) { finish(ending); },
    dispose() { ended = true; stopThinking(); },
  };
}
