import { isISODate } from '../domain/money';
import { analyzeBillCase } from './gemini-api';
import { backendConfigured, backendLocale } from './backend';
import { prepareSpeech } from './backend-speech';
import { configureUnderstandingAdapter, type UnderstandingAdapter } from './document-understanding';

/**
 * The Gemini adapter for Unfold's "Understanding your documents" step (screens/understanding.tsx): every imported
 * page goes to POST /api/v1/analyze in the user's working language. The result fills the verify screen, and the
 * saved analysis id (Tiger Data) becomes the case's evidence context, which the ElevenLabs reading and the live agent
 * use. Without EXPO_PUBLIC_API_URL the default adapter stays: documents are saved and entered manually.
 */
export const geminiUnderstanding: UnderstandingAdapter = {
  async understand(request, { signal, onPhase }) {
    signal.throwIfAborted();
    if (!request.attachments.length) throw new Error('documents_required');
    if (!request.attachments.some(item => item.origin === 'import')) return { mode: request.attachments.every(item => item.origin === 'sample') ? 'synthetic' : 'manual' };
    onPhase('reading');
    const mapped = await analyzeBillCase(request, backendLocale(request.workingLanguage), signal);
    onPhase('organizing');
    const auditId = mapped.extraction.auditId;
    // Start the ElevenLabs reading now, so Listen on the review plays at once (only when Gemini found bill lines).
    if (auditId && mapped.lineItems.length) void prepareSpeech(auditId).catch(() => {});
    return {
      mode: 'extracted',
      contextId: auditId,
      details: {
        ...(mapped.provider ? { provider: mapped.provider } : {}),
        ...(mapped.serviceDate && isISODate(mapped.serviceDate) ? { serviceDate: mapped.serviceDate } : {}),
        financials: mapped.financials, lineItems: mapped.lineItems, extraction: mapped.extraction, findings: mapped.findings,
      },
    };
  },
};

/** Called once from the root layout. */
export function installGeminiUnderstanding(): void {
  if (backendConfigured()) configureUnderstandingAdapter(geminiUnderstanding);
}
