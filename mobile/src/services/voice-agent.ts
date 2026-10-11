import type { BillCase, FamilyProfile, PersonalContext } from '../domain/types';
import { languageOption, type WorkingLanguage } from '../domain/languages';
import type { VoiceChoice } from '../domain/preferences';
export type AgentStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'unavailable' | 'error';
export interface AgentContext {
  language: WorkingLanguage;
  agentLanguage: string;
  voice: VoiceChoice;
  case?: Pick<BillCase, 'id' | 'evidenceContextId' | 'provider' | 'serviceDate' | 'financials' | 'findings' | 'reviewMode'>;
  evidence: { id: string; kind: string; name: string }[];
  profile?: Pick<FamilyProfile, 'firstName' | 'coverage' | 'insurer' | 'planName' | 'zipCode'>;
  preferences: PersonalContext;
  term?: { id: string; title: string; definition: string; example: string };
}
export interface AgentSession { end(): Promise<void>; setMuted(muted: boolean): Promise<void>; }
export interface AgentMessage { role: 'user' | 'agent'; text: string; id?: string; final?: boolean; }
export interface AgentAdapter {
  /** Request a short-lived session from the backend. Never embed ElevenLabs API keys. */
  connect(context: AgentContext, options: { signal: AbortSignal; onStatus: (status: AgentStatus) => void; onMessage: (message: AgentMessage) => void }): Promise<AgentSession>;
}
export class AgentUnavailable extends Error {}
let adapter: AgentAdapter = { async connect() { throw new AgentUnavailable('Live voice conversations aren’t connected in this build. Your voice and language choices are saved for the connection.'); } };
export function configureAgentAdapter(next: AgentAdapter) { adapter = next; }
export const voiceAgentService: AgentAdapter = { connect: (context, options) => adapter.connect(context, options) };
export function agentLanguage(language: WorkingLanguage) { return languageOption(language).agentCode; }
export type AgentSnapshot = { status: AgentStatus; muted: boolean; error?: string; messages: AgentMessage[]; caption?: AgentMessage };
export class AgentController {
  private snapshot: AgentSnapshot = { status: 'idle', muted: false, messages: [] };
  private listeners = new Set<() => void>();
  private abort?: AbortController;
  private session?: AgentSession;
  constructor(private readonly service: AgentAdapter) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<AgentSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach(listener => listener()); }
  async start(context: AgentContext) {
    if (this.abort || this.session) return;
    const abort = new AbortController(); this.abort = abort;
    this.update({ status: 'connecting', muted: false, error: undefined, messages: [], caption: undefined });
    try {
      const session = await this.service.connect(context, {
        signal: abort.signal,
        onStatus: status => {
          if (this.abort === abort && !abort.signal.aborted) this.update({ status, ...(status === 'listening' || status === 'thinking' || status === 'idle' ? { caption: undefined } : {}) });
        },
        onMessage: message => {
          if (this.abort !== abort || abort.signal.aborted || !message.text.trim()) return;
          const messages = [...this.snapshot.messages];
          const index = message.id ? messages.findIndex(m => m.id === message.id && m.role === message.role) : -1;
          if (index >= 0) {
            if (messages[index].final) return;
            messages[index] = message;
          } else messages.push(message);
          this.update({ messages: messages.slice(-20), ...(message.role === 'agent' ? { caption: message } : {}) });
        },
      });
      if (this.abort !== abort || abort.signal.aborted) { await session.end(); return; }
      this.session = session;
      if (this.snapshot.status === 'connecting') this.update({ status: 'listening' });
    } catch (e) {
      if (this.abort === abort && !abort.signal.aborted) { this.abort = undefined; this.update({ status: e instanceof AgentUnavailable ? 'unavailable' : 'error', error: e instanceof AgentUnavailable ? e.message : 'The conversation couldn’t connect. Check microphone access and your connection, then try again.' }); }
    }
  }
  async toggleMuted() {
    const session = this.session;
    if (!session) return;
    try { const muted = !this.snapshot.muted; await session.setMuted(muted); if (this.session === session) this.update({ muted }); } catch { if (this.session === session) this.update({ error: 'Microphone control failed. End the conversation and try again.' }); }
  }
  async end() {
    this.abort?.abort(); this.abort = undefined;
    const session = this.session; this.session = undefined;
    this.update({ status: 'idle', muted: false, caption: undefined });
    try { await session?.end(); } catch { this.update({ error: 'The voice connection did not close cleanly. Please check your connection.' }); }
  }
}
