import type { DocumentAttachment, Language } from '../domain/types';
import { uploadPart } from './backend-upload';

/**
 * The ClaimPulse backend, from EXPO_PUBLIC_API_URL (for example http://192.168.1.23:8000; see mobile/.env.example).
 * When it is unset, the app stays fully local, as before. The routes are in docs/API_CONTRACTS.md.
 */
const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');

export function backendConfigured(): boolean {
  return API_URL !== '';
}

/** Audio URLs from the backend are relative: this makes them absolute. */
export function backendUrl(path: string): string {
  return `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

export interface BackendLineItem {
  cpt_code: string | null;
  original_description: string;
  plain_description: string;
  billed_amount: number | null;
  date_of_service: string | null;
  possible_issues: string[];
}
export interface BackendAnalysis {
  target_language: string;
  model: string;
  mock: boolean;
  result: {
    document_type: string;
    provider_name: string | null;
    total_billed: number | null;
    amount_patient_owes: number | null;
    due_date: string | null;
    line_items: BackendLineItem[];
    plain_summary: string;
    spoken_summary: string;
    questions_to_ask: string[];
  };
  audit: { saved: boolean; audit_id: string | null; error: string | null } | null;
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

// Gemini usually answers in 6–13 s; the backend gives it up to 150 s before answering 504.
const ANALYZE_TIMEOUT_MS = 155_000;
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

/** POST /api/v1/analyze with one file: Gemini's reading, the Medicare price check, and the saved record. */
export async function analyzeUpload(file: Blob, name: string, language: Language): Promise<BackendAnalysis> {
  const form = new FormData();
  form.append('file', file, name);
  form.append('target_language', language);
  return call('/api/v1/analyze', { method: 'POST', body: form }, ANALYZE_TIMEOUT_MS);
}

export async function analyzeDocument(attachment: DocumentAttachment, language: Language): Promise<BackendAnalysis> {
  return analyzeUpload(await uploadPart(attachment), attachment.name, language);
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
