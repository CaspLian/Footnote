import type { BillCase, FamilyProfile, PersonalContext } from '../domain/types';
import type { WorkingLanguage } from '../domain/languages';

export type UnderstandingPhase = 'reading' | 'organizing';
export interface UnderstandingRequest {
  caseId: string;
  attachments: BillCase['attachments'];
  workingLanguage: WorkingLanguage;
  profile?: FamilyProfile;
  personalContext: PersonalContext;
  savedAnalysisId?: string;
  dateRecoveryAttempted?: boolean;
}
export interface UnderstandingResult {
  /** An opaque backend context reference for a later evidence review and live agent. */
  contextId?: string;
  /** extraction and findings come from the Gemini adapter (services/gemini-understanding.ts). */
  details?: Partial<Pick<BillCase, 'provider' | 'serviceDate' | 'financials' | 'lineItems' | 'extraction' | 'findings' | 'claimId' | 'claimDeadlines' | 'dateRecoveryAttempted'>>;
  mode: 'extracted' | 'manual' | 'synthetic';
}
export interface UnderstandingAdapter {
  understand(request: UnderstandingRequest, options: { signal: AbortSignal; onPhase: (phase: UnderstandingPhase) => void }): Promise<UnderstandingResult>;
}
/** Teammates install the Gemini adapter here. No private files leave the device by default. */
let adapter: UnderstandingAdapter = {
  async understand(request, { signal }) {
    signal.throwIfAborted();
    if (!request.attachments.length) throw new Error('documents_required');
    return { mode: request.attachments.every(a => a.origin === 'sample') ? 'synthetic' : 'manual' };
  },
};
export function configureUnderstandingAdapter(next: UnderstandingAdapter) { adapter = next; }
export class UnderstandingFailure extends Error {}
export const understandingService: UnderstandingAdapter = { understand: (request, options) => adapter.understand(request, options) };

export type UnderstandingSnapshot = { status: 'idle' | 'working' | 'complete' | 'error'; phase: UnderstandingPhase; result?: UnderstandingResult; error?: string };
/** Cancellation discards stale results, even when an adapter ignores AbortSignal. */
export class UnderstandingController {
  private abort?: AbortController;
  private snapshot: UnderstandingSnapshot = { status: 'idle', phase: 'reading' };
  private listeners = new Set<() => void>();
  constructor(private readonly service: UnderstandingAdapter) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(value: UnderstandingSnapshot) { this.snapshot = value; this.listeners.forEach(listener => listener()); }
  cancel = () => { this.abort?.abort(); this.abort = undefined; this.update({ status: 'idle', phase: 'reading' }); };
  async run(request: UnderstandingRequest) {
    if (this.snapshot.status === 'working') return;
    if (!request.attachments.length) { this.update({ status: 'error', phase: 'reading', error: 'Add at least one document to continue.' }); return; }
    const abort = new AbortController(); this.abort = abort;
    this.update({ status: 'working', phase: 'reading' });
    try {
      const result = await this.service.understand(request, { signal: abort.signal, onPhase: phase => { if (this.abort === abort && !abort.signal.aborted) this.update({ status: 'working', phase }); } });
      if (this.abort === abort && !abort.signal.aborted) this.update({ status: 'complete', phase: 'organizing', result });
    } catch (error) {
      if (this.abort === abort && !abort.signal.aborted) this.update({ status: 'error', phase: this.snapshot.phase, error: error instanceof UnderstandingFailure ? `${error.message} Your copies are saved. Try again, or enter the details yourself.` : 'We couldn’t finish understanding these documents. Your copies are saved. Try again, or enter the details yourself.' });
    }
  }
}
