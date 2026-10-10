import type { ClaimChange } from '../domain/types';

/**
 * The ClaimPulse backend, from EXPO_PUBLIC_API_URL (for example http://192.168.1.23:8000; see mobile/.env.example).
 * When it is unset, the app stays fully local, as before. The routes are in docs/API_CONTRACTS.md.
 * Documents are sent by services/gemini-api.ts (every page in one request); this file holds the rest.
 */
const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');

export function backendConfigured(): boolean {
  return API_URL !== '';
}

/** Audio URLs from the backend are relative: this makes them absolute. */
export function backendUrl(path: string): string {
  return `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

export interface BackendBenchmark {
  cpt_code: string;
  medicare_rate: number | null;
  medicare_description: string | null;
  setting: string | null;
  source: string;
  error: string | null;
}
export interface BackendSpeech {
  ok: boolean;
  audio_url: string | null;
  voice: string | null;
  text: string;
  error_code: string | null;
  error_message: string | null;
}

export class BackendError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'BackendError';
  }
}

const LOOKUP_TIMEOUT_MS = 20_000;
const SPEAK_TIMEOUT_MS = 60_000;

function detailText(body: unknown): string | undefined {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return 'invalid_request';
  if (detail && typeof detail === 'object' && 'message' in detail) return String((detail as { message: unknown }).message);
  return undefined;
}

async function call<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  if (!backendConfigured()) throw new BackendError(0, 'backend_not_configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(backendUrl(path), { ...init, signal: controller.signal });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new BackendError(response.status, detailText(body) ?? `HTTP ${response.status}`);
    return body as T;
  } catch (error) {
    if (error instanceof BackendError) throw error;
    throw new BackendError(0, controller.signal.aborted ? 'timeout' : 'unreachable');
  } finally {
    clearTimeout(timer);
  }
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return call(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, LOOKUP_TIMEOUT_MS);
}

export interface ClaimIn {
  items: { code: string; description: string; amount: number }[];
  provider_name?: string;
  service_date?: string;
  total_billed?: number;
  analysis_audit_id?: string;
}

/** POST /api/v1/claims: records a confirmed bill as a claim in Tiger Data; resolves to its audit_id. */
export async function recordClaim(claim: ClaimIn): Promise<{ audit_id: string }> {
  return postJson('/api/v1/claims', claim);
}

export async function updateClaim(claimId: string, change: ClaimChange): Promise<void> {
  const base = `/api/v1/claims/${encodeURIComponent(claimId)}`;
  if ('status' in change) await postJson(`${base}/status`, { status: change.status });
  else if ('collectionDeadline' in change) await postJson(`${base}/deadlines`, { collection_deadline: change.collectionDeadline });
  else await postJson(`${base}/resolve`, { final_amount: change.finalCents / 100 });
}

/** GET /api/v1/benchmarks/{code}: Medicare's national rate for one code (free; no Gemini call). */
export async function lookupBenchmark(code: string): Promise<BackendBenchmark> {
  return call(`/api/v1/benchmarks/${encodeURIComponent(code)}`, { method: 'GET' }, LOOKUP_TIMEOUT_MS);
}

/** POST /api/v1/voice/speak: an ElevenLabs reading of a saved analysis. HTTP 200 even when speech.ok is false. */
export async function speakAnalysis(auditId: string, voice?: string): Promise<BackendSpeech> {
  const form = new FormData();
  form.append('audit_id', auditId);
  if (voice) form.append('voice', voice);
  return call('/api/v1/voice/speak', { method: 'POST', body: form }, SPEAK_TIMEOUT_MS);
}
