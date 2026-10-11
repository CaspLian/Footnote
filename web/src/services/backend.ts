/**
 * The Footnote backend for the web app. Set VITE_API_URL (for example http://127.0.0.1:8000; see web/.env.example)
 * to use it. Unset, `backend.configured` is false, nothing is sent anywhere, and document analysis is unavailable.
 * Every route and field is in docs/API_CONTRACTS.md; these are the calls the mobile app makes too
 * (mobile/src/services/backend.ts).
 */

/** One line of the bill as Gemini read it (backend/models.py, LineItem). */
export interface BackendLineItem {
  cpt_code: string | null;
  original_description: string;
  plain_description: string;
  billed_amount: number | null;
  date_of_service: string | null; // YYYY-MM-DD
  source_page: number | null;
  possible_issues: string[];
}

export interface GeminiResult {
  document_type: 'hospital_bill' | 'eob' | 'insurance_policy' | 'pharmacy_receipt' | 'other' | string;
  provider_name: string | null;
  total_billed: number | null;
  amount_patient_owes: number | null;
  due_date: string | null; // YYYY-MM-DD
  line_items: BackendLineItem[];
  plain_summary: string;
  spoken_summary: string;
  questions_to_ask: string[];
}

export type PriceFlag = 'no_code' | 'no_benchmark' | 'no_amount' | 'typical' | 'above_typical' | 'far_above_typical';

/** One line compared with Medicare's national rate (backend/models.py, PriceCheck). */
export interface PriceCheck {
  line_index: number;
  cpt_code: string | null;
  billed_amount: number | null;
  medicare_rate: number | null;
  medicare_description: string | null;
  times_medicare: number | null;
  flag: PriceFlag;
  note: string; // English
}

export interface PriceSummary {
  source: string;
  items_checked: number;
  items_flagged: number;
  billed_total_checked: number;
  medicare_total_checked: number;
  error: string | null;
}

export interface AuditInfo {
  saved: boolean;
  audit_id: string | null;
  error: string | null;
}

/** What POST /api/v1/analyze returns. All text is in `target_language`, the resolved locale (e.g. "es-MX"). */
export interface AnalyzeResponse {
  target_language: string;
  model: string;
  mock: boolean;
  result: GeminiResult;
  price_checks: PriceCheck[];
  price_summary: PriceSummary | null;
  audit: AuditInfo | null;
}

/** A saved analysis (GET /api/v1/audits/{id}), exactly as it was returned. */
export interface SavedAnalysis {
  audit_id: string;
  created_at: string;
  source: string;
  transcript: string | null;
  analysis: AnalyzeResponse;
}

/** An ElevenLabs reading (POST /api/v1/voice/speak). HTTP 200 even when `ok` is false: the text answer still stands. */
export interface Speech {
  ok: boolean;
  audio_url: string | null; // relative: play backend.url(audio_url)
  mime_type: string | null;
  voice: string | null;
  streaming: boolean;
  text: string | null; // exactly what the voice says: show it as captions
  error_code: string | null;
  error_message: string | null;
}

export interface Voice {
  key: string;
  name: string;
  description: string;
  accent: string;
  gender: string;
}

/** GET /api/v1/voice/voices. Without a chosen voice, a language gets `language_defaults` (e.g. "es": "elio"). */
export interface VoiceList {
  default: string;
  language_defaults: Record<string, string>;
  voices: Voice[];
}

/** GET /api/v1/benchmarks/{code}: free, no Gemini call. `medicare_rate` is null when there is no rate. */
export interface Benchmark {
  cpt_code: string;
  medicare_rate: number | null;
  medicare_description: string | null;
  setting: string | null;
  source: string;
  error: string | null;
}

/** POST /api/v1/claims: a confirmed bill becomes a claim in Tiger Data, with estimated deadlines. */
export interface ClaimIn {
  items: { code: string; description: string; amount: number }[];
  provider_name?: string;
  service_date?: string; // YYYY-MM-DD
  total_billed?: number;
  bill_received_date?: string;
  payment_due_date?: string;
  analysis_audit_id?: string;
}

/** GET /api/v1/claims/{id} (the fields screens need; the response has a few more). */
export interface Claim {
  audit_id: string;
  status: string;
  provider: { name: string | null; npi: string | null };
  service_date: string | null;
  total_billed: number | null;
  collection_deadline: string | null;
  collection_deadline_is_estimate: boolean;
  credit_warning_date: string | null;
  credit_warning_date_is_estimate: boolean;
  collection_days_remaining: number | null;
  credit_warning_days_remaining: number | null;
  events: unknown[];
  items: { code: string; description: string; amount: number; benchmark_amount: number | null; flagged: boolean }[];
}

/**
 * A failed call. `status` is the HTTP status, or 0 when the backend could not be reached (`message` is then
 * "backend_not_configured", "unreachable" or "timeout"). `stage` says which step failed on the voice routes and
 * for an unsupported language ("language").
 */
export class BackendError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly stage?: string,
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

export interface Backend {
  readonly configured: boolean;
  /** The backend's address for a path it returned, such as `speech.audio_url`. */
  url(path: string): string;
  /** The 42 locales answers can be written and spoken in: {"en-US": "English (United States)", ...}. */
  languages(): Promise<Record<string, string>>;
  /** Bill pages (photos or PDFs, in order) and/or a typed question -> Gemini -> Medicare price check -> saved. */
  analyze(documents: Blob[], options?: { language?: string; text?: string }): Promise<AnalyzeResponse>;
  audit(auditId: string): Promise<SavedAnalysis>;
  /** The ElevenLabs reading of a saved analysis, in its language. Each voice is its own clip. */
  speak(auditId: string, voice?: string): Promise<Speech>;
  voices(): Promise<VoiceList>;
  voiceSampleUrl(voiceKey: string): string;
  benchmark(code: string): Promise<Benchmark>;
  recordClaim(claim: ClaimIn): Promise<{ audit_id: string }>;
  claim(claimId: string): Promise<Claim>;
  setClaimStatus(claimId: string, status: 'audit_complete' | 'dispute_in_progress', note?: string): Promise<void>;
  logClaimAction(claimId: string, action: string, note?: string): Promise<void>;
}

export interface BackendOptions {
  fetch?: typeof fetch;
  /** Milliseconds. Gemini can take up to 150 s server-side on a slow multi-page bill. */
  analyzeTimeoutMs?: number;
  speakTimeoutMs?: number;
  lookupTimeoutMs?: number;
}

function detailOf(body: unknown): { message?: string; stage?: string } {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return { message: detail };
  if (Array.isArray(detail)) return { message: 'invalid_request' }; // FastAPI's own field errors
  if (detail && typeof detail === 'object') {
    const { message, stage } = detail as { message?: unknown; stage?: unknown };
    return { message: message === undefined ? undefined : String(message), stage: stage === undefined ? undefined : String(stage) };
  }
  return {};
}

export function createBackend(baseUrl: string, options: BackendOptions = {}): Backend {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const fetcher: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));
  const timeouts = {
    analyze: options.analyzeTimeoutMs ?? 180_000,
    speak: options.speakTimeoutMs ?? 60_000,
    lookup: options.lookupTimeoutMs ?? 20_000,
  };
  const url = (path: string) => `${base}${path.startsWith('/') ? '' : '/'}${path}`;

  async function call<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
    if (!base) throw new BackendError(0, 'backend_not_configured');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(url(path), { ...init, signal: controller.signal });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = detailOf(body);
        throw new BackendError(response.status, detail.message ?? `HTTP ${response.status}`, detail.stage);
      }
      return body as T;
    } catch (error) {
      if (error instanceof BackendError) throw error;
      throw new BackendError(0, controller.signal.aborted ? 'timeout' : 'unreachable');
    } finally {
      clearTimeout(timer);
    }
  }

  const get = <T,>(path: string) => call<T>(path, { method: 'GET' }, timeouts.lookup);
  const postJson = <T,>(path: string, body: unknown) =>
    call<T>(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, timeouts.lookup);
  const claimPath = (claimId: string) => `/api/v1/claims/${encodeURIComponent(claimId)}`;

  return {
    configured: base !== '',
    url,
    languages: () => get('/api/v1/languages'),
    analyze(documents, { language, text } = {}) {
      const form = new FormData();
      documents.forEach((document, index) => {
        const name = document instanceof File ? document.name : `page-${index + 1}`;
        form.append('files', document, name);
      });
      if (text?.trim()) form.append('text', text.trim());
      if (language) form.append('target_language', language);
      return call('/api/v1/analyze', { method: 'POST', body: form }, timeouts.analyze);
    },
    audit: auditId => get(`/api/v1/audits/${encodeURIComponent(auditId)}`),
    speak(auditId, voice) {
      const form = new FormData();
      form.append('audit_id', auditId);
      if (voice) form.append('voice', voice);
      return call('/api/v1/voice/speak', { method: 'POST', body: form }, timeouts.speak);
    },
    voices: () => get('/api/v1/voice/voices'),
    voiceSampleUrl: voiceKey => url(`/api/v1/voice/voices/${encodeURIComponent(voiceKey)}/sample`),
    benchmark: code => get(`/api/v1/benchmarks/${encodeURIComponent(code.trim())}`),
    recordClaim: claim => postJson('/api/v1/claims', claim),
    claim: claimId => get(claimPath(claimId)),
    async setClaimStatus(claimId, status, note) {
      await postJson(`${claimPath(claimId)}/status`, { status, ...(note ? { note } : {}) });
    },
    async logClaimAction(claimId, action, note) {
      await postJson(`${claimPath(claimId)}/actions`, { action, ...(note ? { note } : {}) });
    },
  };
}

/** The app's backend, from VITE_API_URL. */
export const backend: Backend = createBackend(String(import.meta.env.VITE_API_URL ?? ''));
