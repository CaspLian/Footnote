// The live agent's backend boundary: form requests, short-lived credentials, and readable refusal messages.
// The microphone and ElevenLabs client are injected by native/live-agent.ts so this module is testable in Node.
import { AgentUnavailable, type AgentAdapter, type AgentConnectOptions, type AgentContext, type AgentSession } from './voice-agent';
import { backendConfigured, backendLocale, backendUrl } from './backend';
import { languageOption } from '../domain/languages';
import { voiceKeyFor } from './voice-catalog';

export const AGENT_SESSION_ROUTE = '/api/v1/voice/agent/session';
export const SESSION_TIMEOUT_MS = 20_000;
export type ConnectionType = 'webrtc' | 'websocket';

export interface AgentSessionRequest { auditId: string; targetLanguage: string; voice?: string; connectionType: ConnectionType }
/** The SDK's camelCase overrides, passed through untouched (the backend only sends ones the agent allows). */
export interface AgentOverrides {
  agent?: { language?: string; firstMessage?: string };
  tts?: { voiceId?: string };
  asr?: { keywords?: string[] };
}
/** One bill line as the agent was told it (revision 2's `lines`); numbered from 1, like the tools' line_number. */
export interface AgentLine { number: number; name: string; billedAmount?: number; label?: string; inContext: boolean }
export interface AgentSessionGrant {
  connectionType: ConnectionType;
  conversationToken?: string;
  signedUrl?: string;
  startWithinSeconds: number;
  conversationId?: string;
  userId?: string;
  locale?: string;
  language?: string;
  voice?: string;
  auditId?: string;
  dynamicVariables: Record<string, string | number | boolean>;
  overrides: AgentOverrides;
  clientTools: string[];
  lines: AgentLine[];
  /** Must be shown before the call starts (backend rule). */
  privacyNotice?: string;
}

export const NO_ANALYSIS_TEXT = 'Live conversations need a bill that ClaimPulse has read. Add the bill’s pages to this case, then try again.';
export const CORRECTED_ANALYSIS_TEXT = 'Your confirmed details differ from the saved document reading. Live bill conversations are paused so the helper does not describe old amounts. Use your confirmed review and contact billing about the correction.';
export const GUIDE_TEXT = 'Live conversations work from a bill’s review for now. Open a bill that ClaimPulse has read to talk it through.';
export const ORIGIN_TEXT = 'This page isn’t allowed to start live conversations. Open Unfold at http://localhost or http://127.0.0.1.';
export const busyText = (seconds?: number) => `Too many conversations were started just now. Try again in ${seconds && seconds > 0 ? Math.ceil(seconds) : 10} seconds.`;
export const NOT_SET_UP_TEXT = 'Live conversations aren’t set up on this server yet.';
export const ROUTE_MISSING_TEXT = 'This ClaimPulse server doesn’t offer live conversations yet.';
export const ANALYSIS_GONE_TEXT = 'This bill’s saved analysis isn’t on the server anymore. Add the bill’s pages again, then try again.';
export const PROVIDER_TEXT = 'Live conversations are unavailable right now. Try again later.';
export const languageText = (name: string) => `Live conversations aren’t available in ${name} yet. Choose another working language to talk it through.`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The route needs a saved analysis (revision 2: audit_id is required, no general call in v1). */
export function sessionAuditId(context: AgentContext): string {
  if (!context.case) throw new AgentUnavailable(GUIDE_TEXT);
  if (context.case.entriesEdited) throw new AgentUnavailable(CORRECTED_ANALYSIS_TEXT);
  const id = context.case.evidenceContextId;
  if (id && UUID.test(id)) return id;
  throw new AgentUnavailable(NO_ANALYSIS_TEXT);
}

/** Form fields, like /voice/speak: never JSON (FastAPI's Form() would silently ignore a JSON body). Empty values are left out. */
export function agentSessionForm(request: AgentSessionRequest): FormData {
  const form = new FormData();
  form.append('audit_id', request.auditId);
  form.append('target_language', request.targetLanguage);
  if (request.voice) form.append('voice', request.voice);
  form.append('connection_type', request.connectionType);
  return form;
}

export class AgentSessionError extends Error {
  constructor(readonly kind: 'invalid_response' | 'unreachable' | 'timeout' | 'http', readonly status = 0, readonly detail?: unknown, readonly retryAfterSeconds?: number) { super(kind); this.name = 'AgentSessionError'; }
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined);

export function parseAgentSession(body: unknown, expected: ConnectionType): AgentSessionGrant {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const token = text(b.conversation_token), url = text(b.signed_url);
  if (b.connection_type !== expected || (expected === 'webrtc' ? !token : !url)) throw new AgentSessionError('invalid_response');
  const vars = b.dynamic_variables;
  if (!vars || typeof vars !== 'object' || Array.isArray(vars) || Object.values(vars).some(v => !['string', 'number', 'boolean'].includes(typeof v) || typeof v === 'number' && !Number.isFinite(v))) throw new AgentSessionError('invalid_response');
  if (b.overrides !== undefined && b.overrides !== null && (typeof b.overrides !== 'object' || Array.isArray(b.overrides))) throw new AgentSessionError('invalid_response');
  return {
    connectionType: expected, conversationToken: token, signedUrl: url,
    startWithinSeconds: typeof b.start_within_seconds === 'number' ? b.start_within_seconds : 600,
    conversationId: text(b.conversation_id), userId: text(b.user_id), locale: text(b.locale), language: text(b.language),
    voice: text(b.voice), auditId: text(b.audit_id),
    dynamicVariables: vars as Record<string, string | number | boolean>, overrides: (b.overrides ?? {}) as AgentOverrides,
    clientTools: Array.isArray(b.client_tools) ? b.client_tools.filter((t): t is string => typeof t === 'string') : [],
    lines: Array.isArray(b.lines) ? b.lines.flatMap(parseLine) : [],
    privacyNotice: text(b.privacy_notice),
  };
}

function parseLine(value: unknown): AgentLine[] {
  const l = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  if (typeof l.number !== 'number' || !Number.isSafeInteger(l.number) || l.number < 1) return [];
  return [{ number: l.number, name: text(l.name) ?? '', billedAmount: typeof l.billed_amount === 'number' ? l.billed_amount : undefined, label: text(l.label), inContext: l.in_context === true }];
}

/** What the orb shows for a refused session: an AgentUnavailable (a person or the setup must change something) or a plain Error (retry). */
export function sessionFailure(status: number, detail: unknown, languageName: string, retryAfterSeconds?: number): Error {
  const d = (detail && typeof detail === 'object' && !Array.isArray(detail) ? detail : {}) as { stage?: unknown; error_code?: unknown };
  const stage = typeof d.stage === 'string' ? d.stage : undefined;
  const code = typeof d.error_code === 'string' ? d.error_code : undefined;
  if (status === 405 || status === 404 && detail === 'Not Found') return new AgentUnavailable(ROUTE_MISSING_TEXT);
  if (status === 403 && code === 'ORIGIN_NOT_ALLOWED') return new AgentUnavailable(ORIGIN_TEXT);
  if (status === 429) return new AgentUnavailable(busyText(retryAfterSeconds));            // our route's limit: 1 per 10 s per device, 30 an hour
  if (stage === 'language') return new AgentUnavailable(languageText(languageName));
  if (stage === 'audit' && (status === 400 || status === 404 || status === 409)) return new AgentUnavailable(ANALYSIS_GONE_TEXT);
  if (stage === 'agent' && code === 'NOT_CONFIGURED') return new AgentUnavailable(NOT_SET_UP_TEXT);
  if (status === 502 && stage === 'agent') return new AgentUnavailable(PROVIDER_TEXT);
  return new Error(`agent_session_${status}${code ? `_${code}` : ''}`); // 503 retryable, audit 503, 500, 422, INVALID_REQUEST: the orb's retry text
}

export async function requestAgentSession(request: AgentSessionRequest, deps: { url: string; signal: AbortSignal; fetchImpl?: typeof fetch; timeoutMs?: number }): Promise<AgentSessionGrant> {
  deps.signal.throwIfAborted();
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  deps.signal.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? SESSION_TIMEOUT_MS);
  try {
    let response: Response;
    try { response = await (deps.fetchImpl ?? fetch)(deps.url, { method: 'POST', body: agentSessionForm(request), signal: controller.signal }); }
    catch (e) { if (deps.signal.aborted) throw e; throw new AgentSessionError(controller.signal.aborted ? 'timeout' : 'unreachable'); }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const retryAfter = Number(response.headers?.get?.('retry-after'));
      throw new AgentSessionError('http', response.status, (body as { detail?: unknown } | null)?.detail, Number.isFinite(retryAfter) ? retryAfter : undefined);
    }
    return parseAgentSession(body, request.connectionType);
  } finally { clearTimeout(timer); deps.signal.removeEventListener('abort', onAbort); }
}

export interface SessionAdapterDeps<P> {
  fallback: AgentAdapter;
  backendConfigured?(): boolean;
  backendLocale?(language: AgentContext['language']): string;
  languageName?(language: AgentContext['language']): string;
  sessionUrl?(): string;
  resolveVoice?(choice: AgentContext['voice'], locale: string): Promise<string | undefined>;
  /** Device checks before any network call (the SDK is in this build; microphone access). */
  prepare?(context: AgentContext, signal: AbortSignal): Promise<P>;
  /** Starts the conversation with the minted session. Without it, a session is refused as "needs an app update". */
  open?(grant: AgentSessionGrant, context: AgentContext, options: AgentConnectOptions, prepared: P): Promise<AgentSession>;
  fetchImpl?: typeof fetch;
}

export function createVoiceAgentSessionAdapter<P>(deps: SessionAdapterDeps<P>): AgentAdapter {
  return {
    async connect(context, options) {
      if (!(deps.backendConfigured ?? backendConfigured)()) return deps.fallback.connect(context, options);
      options.signal.throwIfAborted();
      const auditId = sessionAuditId(context);                       // before the microphone prompt and any request
      const prepared = deps.prepare ? await deps.prepare(context, options.signal) : (undefined as P);
      options.signal.throwIfAborted();
      const locale = (deps.backendLocale ?? backendLocale)(context.language);
      const voice = await (deps.resolveVoice ?? voiceKeyFor)(context.voice, locale);
      options.signal.throwIfAborted();
      let grant: AgentSessionGrant;
      try { grant = await requestAgentSession({ auditId, targetLanguage: locale, voice, connectionType: 'webrtc' }, { url: deps.sessionUrl?.() ?? backendUrl(AGENT_SESSION_ROUTE), signal: options.signal, fetchImpl: deps.fetchImpl }); }
      catch (e) { if (e instanceof AgentSessionError && e.kind === 'http') throw sessionFailure(e.status, e.detail, deps.languageName?.(context.language) ?? languageOption(context.language).name, e.retryAfterSeconds); throw e; }
      options.signal.throwIfAborted();
      if (!deps.open) throw new AgentUnavailable('Live voice conversations need an app update before they can start here.');
      return deps.open(grant, context, options, prepared);
    },
  };
}
