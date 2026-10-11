import { throwIfAborted } from './abort-signal';
import type { BillCase } from '../domain/types';
import { isISODate } from '../domain/money';
import type { mapGeminiAnalysis } from '../domain/extraction';
import type { UnderstandingRequest } from './document-understanding';
import type { AppendDocumentPart } from './gemini-api';
import { call } from './backend';

type ImageDates = { extracted_bill?: { service_date?: string; payment_due_date?: string }; audit?: { audit_id?: string; collection_deadline?: string | null; collection_deadline_is_estimate?: boolean; credit_warning_date?: string | null; credit_warning_date_is_estimate?: boolean } };
const attempted = new Set<string>();
/** The alternate date route records a claim; reuse it later so verification cannot create it twice. */
export async function recoverBillDates(request: UnderstandingRequest, mapped: ReturnType<typeof mapGeminiAnalysis>, appendPart: AppendDocumentPart, signal: AbortSignal, markAttempt?: (caseId: string) => void): Promise<Partial<BillCase>> {
  if (request.dateRecoveryAttempted || attempted.has(request.caseId) || isISODate(mapped.serviceDate ?? '') && isISODate(mapped.extraction.dueDate ?? '')) return {};
  const image = request.attachments.find(item => item.origin === 'import' && ['image/jpeg', 'image/png', 'image/webp'].includes(item.mimeType));
  if (!image) return {};
  throwIfAborted(signal); attempted.add(request.caseId); markAttempt?.(request.caseId);
  const details: Partial<BillCase> = { dateRecoveryAttempted: true };
  try {
    const form = new FormData(); await appendPart(form, image, 'file'); throwIfAborted(signal);
    const reply = await call<ImageDates>('/api/v1/analyze-image', { method: 'POST', body: form }, 180_000, signal);
    const dates = reply.extracted_bill;
    if (!isISODate(mapped.serviceDate ?? '') && dates?.service_date && isISODate(dates.service_date)) details.serviceDate = dates.service_date;
    if (!isISODate(mapped.extraction.dueDate ?? '') && dates?.payment_due_date && isISODate(dates.payment_due_date)) mapped.extraction.dueDate = dates.payment_due_date;
    if (reply.audit?.audit_id) {
      details.claimId = reply.audit.audit_id;
      details.claimDeadlines = { collectionDeadline: reply.audit.collection_deadline ?? undefined, collectionIsEstimate: !!reply.audit.collection_deadline_is_estimate, creditWarningDate: reply.audit.credit_warning_date ?? undefined, creditWarningIsEstimate: !!reply.audit.credit_warning_date_is_estimate };
    }
  } catch (error) { if (signal.aborted) throw error; }
  return details;
}
