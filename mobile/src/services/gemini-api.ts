import { throwIfAborted } from './abort-signal';
import type { BillCase, DocumentAttachment } from '../domain/types';
import { mapGeminiAnalysis, type GeminiAnalyzeResponse } from '../domain/extraction';
import { backendConfigured, backendUrl } from './backend';

const MAX_PAGES = 10; // the backend's limits for POST /api/v1/analyze (docs/API_CONTRACTS.md)
const MAX_BYTES = 15 * 1024 * 1024;
export type AppendDocumentPart = (form: FormData, attachment: DocumentAttachment, field?: string) => void | Promise<void>;
export function uploadProblem(documents: DocumentAttachment[]): string | undefined {
  if (documents.length > MAX_PAGES) return `Choose up to ${MAX_PAGES} pages for one analysis.`;
  if (documents.reduce((sum, item) => sum + (item.size ?? 0), 0) > MAX_BYTES) return 'These pages exceed the 15 MB upload limit. Remove a page or use smaller photos.';
}

/**
 * Sends every imported page of a case to POST /api/v1/analyze in one request. targetLanguage is a backend locale
 * (backendLocale() in ./backend). The caller's signal cancels the upload; a 180 s timeout also applies.
 */
export async function analyzeBillCase(billCase: Pick<BillCase, 'attachments'>, targetLanguage: string, appendPart: AppendDocumentPart, signal?: AbortSignal) {
  throwIfAborted(signal);
  const documents = billCase.attachments.filter(item => item.origin === 'import');
  if (!backendConfigured()) throw new Error('No Footnote backend is set (EXPO_PUBLIC_API_URL). Enter the details from the original instead.');
  if (!documents.length) throw new Error('Add a bill photo or PDF before analyzing.');
  const problem = uploadProblem(documents); if (problem) throw new Error(problem);
  const form = new FormData();
  for (const attachment of documents) { throwIfAborted(signal); await appendPart(form, attachment); }
  throwIfAborted(signal);
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
    throw new Error(`Could not reach the Footnote backend at ${backendUrl('')}. Check EXPO_PUBLIC_API_URL and your network.`);
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
