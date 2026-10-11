import type { BillCase } from '@/domain';
import { mapGeminiAnalysis, type GeminiAnalyzeResponse } from '@/domain/extraction';
import { appendAttachmentToForm } from '@/native';
import { backendConfigured, backendUrl } from './backend';

const MAX_PAGES = 10; // the backend's limits for POST /api/v1/analyze (docs/API_CONTRACTS.md)
const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Sends every imported page of a case to POST /api/v1/analyze in one request. targetLanguage is a backend locale
 * (backendLocale() in ./backend). The caller's signal cancels the upload; a 180 s timeout also applies.
 */
export async function analyzeBillCase(billCase: Pick<BillCase, 'attachments'>, targetLanguage: string, signal?: AbortSignal) {
  const documents = billCase.attachments.filter(item => item.origin === 'import');
  if (!backendConfigured()) throw new Error('No ClaimPulse backend is set (EXPO_PUBLIC_API_URL). Enter the details from the original instead.');
  if (!documents.length) throw new Error('Add a bill photo or PDF before analyzing.');
  if (documents.length > MAX_PAGES) throw new Error(`Choose up to ${MAX_PAGES} pages for one analysis.`);
  if (documents.reduce((total, item) => total + (item.size ?? 0), 0) > MAX_BYTES) throw new Error('These pages exceed the 15 MB upload limit. Remove a page or use smaller photos.');
  const form = new FormData();
  for (const attachment of documents) await appendAttachmentToForm(form, attachment);
  form.append('target_language', targetLanguage);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  let response: Response;
  try { response = await fetch(backendUrl('/api/v1/analyze'), { method: 'POST', body: form, signal: controller.signal }); }
  catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Analysis took too long. Check your connection and try again.');
    throw new Error(`Could not reach the ClaimPulse backend at ${backendUrl('')}. Check EXPO_PUBLIC_API_URL and your network.`);
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', cancel); }
  if (!response.ok) {
    let detail = `Bill analysis failed (${response.status}).`;
    try {
      const body = await response.json() as { detail?: unknown };
      if (typeof body.detail === 'string') detail = body.detail;
    } catch { /* Keep the status-based message when the response is not JSON. */ }
    throw new Error(detail);
  }
  const payload = await response.json() as GeminiAnalyzeResponse;
  // Gemini writes in targetLanguage; the app keeps the same text in both of its LocalizedText slots.
  return mapGeminiAnalysis(payload, billCase, 'en');
}
