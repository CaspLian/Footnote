import type { BillCase, Language } from '@/domain';
import { mapGeminiAnalysis, type GeminiAnalyzeResponse } from '@/domain/extraction';
import { appendAttachmentToForm } from '@/native';
import { backendConfigured, backendUrl } from './backend';

export async function analyzeBillCase(billCase: BillCase, language: Language) {
  const documents = billCase.attachments.filter(item => item.origin === 'import');
  if (!backendConfigured()) throw new Error('No ClaimPulse backend is set (EXPO_PUBLIC_API_URL). Enter the details from the original instead.');
  if (!documents.length) throw new Error('Add a bill photo or PDF before analyzing.');
  const form = new FormData();
  for (const attachment of documents) await appendAttachmentToForm(form, attachment);
  form.append('target_language', language);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  let response: Response;
  try { response = await fetch(backendUrl('/api/v1/analyze'), { method: 'POST', body: form, signal: controller.signal }); }
  catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Analysis took too long. Check your connection and try again.');
    throw new Error(`Could not reach the ClaimPulse backend at ${backendUrl('')}. Check EXPO_PUBLIC_API_URL and your network.`);
  } finally { clearTimeout(timeout); }
  if (!response.ok) {
    let detail = `Bill analysis failed (${response.status}).`;
    try {
      const body = await response.json() as { detail?: unknown };
      if (typeof body.detail === 'string') detail = body.detail;
    } catch { /* Keep the status-based message when the response is not JSON. */ }
    throw new Error(detail);
  }
  const payload = await response.json() as GeminiAnalyzeResponse;
  return mapGeminiAnalysis(payload, billCase, language);
}
