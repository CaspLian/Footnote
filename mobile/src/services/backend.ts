import { languageOption, type WorkingLanguage } from '../domain/languages';
import type { ClaimChange, ClaimDeadlines } from '../domain/types';
import type { GeminiAnalyzeResponse } from '../domain/extraction';

/**
 * The ClaimPulse backend, from EXPO_PUBLIC_API_URL (for example http://192.168.1.23:8000; see mobile/.env.example).
 * When it is unset, the app stays fully local, as before. The routes are in docs/API_CONTRACTS.md.
 * Documents are sent by services/gemini-api.ts (every page in one request); this file holds the rest.
 */
const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');

export function backendConfigured(): boolean {
  return API_URL !== '';
}

// Unfold names the two Chinese scripts; the backend's locales (GET /api/v1/languages) name their regions.
const LOCALE_OVERRIDES: Partial<Record<WorkingLanguage, string>> = { 'zh-Hans': 'zh-CN', 'zh-Hant': 'zh-TW' };

/** The backend locale (target_language) for a working language: 'fr' -> 'fr-FR', 'zh-Hant' -> 'zh-TW'. */
export function backendLocale(language: WorkingLanguage): string {
  return LOCALE_OVERRIDES[language] ?? languageOption(language).locale;
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

export async function call<T>(path: string, init: RequestInit, timeoutMs: number = LOOKUP_TIMEOUT_MS, signal?: AbortSignal): Promise<T> {
  if (!backendConfigured()) throw new BackendError(0, 'backend_not_configured');
  signal?.throwIfAborted();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(backendUrl(path), { ...init, signal: controller.signal });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new BackendError(response.status, detailText(body) ?? `HTTP ${response.status}`);
    return body as T;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof BackendError) throw error;
    throw new BackendError(0, controller.signal.aborted ? 'timeout' : 'unreachable');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

export function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return call(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, LOOKUP_TIMEOUT_MS, signal);
}

export interface BackendVoiceCatalog { default: string; language_defaults: Record<string, string>; voices: { key: string; name: string; description: string; accent: string; gender: string }[] }
export const voices = () => call<BackendVoiceCatalog>('/api/v1/voice/voices', { method: 'GET' });
export const voiceSampleUrl = (key: string) => backendUrl(`/api/v1/voice/voices/${encodeURIComponent(key)}/sample`);
export const backendHealth = (signal?: AbortSignal) => call<{ message: string; mock: boolean; model: string }>('/', { method: 'GET' }, LOOKUP_TIMEOUT_MS, signal);
export const supportedLanguages = (signal?: AbortSignal) => call<Record<string, string>>('/api/v1/languages', { method: 'GET' }, LOOKUP_TIMEOUT_MS, signal);
export async function loadAudit(id: string, signal?: AbortSignal): Promise<GeminiAnalyzeResponse> {
  const saved = await call<{ analysis: GeminiAnalyzeResponse }>(`/api/v1/audits/${encodeURIComponent(id)}`, { method: 'GET' }, LOOKUP_TIMEOUT_MS, signal);
  if (!saved?.analysis?.result) throw new BackendError(0, 'The saved analysis could not be read.');
  return saved.analysis;
}

export interface ClaimIn {
  items: { code: string; description: string; amount: number }[];
  provider_name?: string;
  service_date?: string;
  total_billed?: number;
  payment_due_date?: string;
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
  else if ('action' in change) await postJson(`${base}/actions`, { action: change.action, note: change.note });
  else await postJson(`${base}/resolve`, { final_amount: change.finalCents / 100 });
}

interface ClaimOut {
  collection_deadline: string | null;
  collection_deadline_is_estimate?: boolean;
  credit_warning_date: string | null;
  credit_warning_date_is_estimate?: boolean;
}

/** GET /api/v1/claims/{id}: the claim's deadlines, and whether each is an estimate from the bill's dates. */
export async function claimDeadlines(claimId: string): Promise<ClaimDeadlines> {
  const claim = await call<ClaimOut>(`/api/v1/claims/${encodeURIComponent(claimId)}`, { method: 'GET' }, LOOKUP_TIMEOUT_MS);
  return {
    collectionDeadline: claim.collection_deadline ?? undefined,
    collectionIsEstimate: !!claim.collection_deadline_is_estimate,
    creditWarningDate: claim.credit_warning_date ?? undefined,
    creditWarningIsEstimate: !!claim.credit_warning_date_is_estimate,
  };
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
