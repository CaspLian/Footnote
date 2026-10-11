import { throwIfAborted } from './abort-signal';
import { isISODate } from '../domain/money';
import { hasSubstantialExtraction, mapGeminiAnalysis } from '../domain/extraction';
import type { VoiceChoice } from '../domain/preferences';
import { analyzeBillCase, uploadProblem, type AppendDocumentPart } from './gemini-api';
import { backendLocale, loadAudit } from './backend';
import { prepareSpeech } from './backend-speech';
import { voiceKeyFor } from './voice-catalog';
import { recoverBillDates } from './image-date-recovery';
import { UnderstandingFailure, type UnderstandingAdapter } from './document-understanding';

export function createGeminiUnderstanding(deps: { appendPart: AppendDocumentPart; currentVoice?: () => VoiceChoice; resolveVoice?: typeof voiceKeyFor; prepare?: typeof prepareSpeech; markDateRecovery?: (caseId: string) => void }): UnderstandingAdapter {
  return { async understand(request, { signal, onPhase }) {
    throwIfAborted(signal);
    const imports = request.attachments.filter(item => item.origin === 'import');
    if (!request.attachments.length) throw new UnderstandingFailure('Add a document before continuing.');
    if (!imports.length) return { mode: request.attachments.every(item => item.origin === 'sample') ? 'synthetic' : 'manual' };
    const problem = uploadProblem(imports); if (problem) throw new UnderstandingFailure(problem);
    onPhase('reading');
    let mapped;
    try {
      mapped = request.savedAnalysisId
        ? mapGeminiAnalysis(await loadAudit(request.savedAnalysisId, signal), request, 'en')
        : await analyzeBillCase(request, backendLocale(request.workingLanguage), deps.appendPart, signal);
    } catch (error) {
      if (signal.aborted) throw error;
      throw new UnderstandingFailure(error instanceof Error ? error.message : 'The analysis could not be loaded.');
    }
    throwIfAborted(signal);
    // This also protects reopened saved answers; a summary without bill facts is not extraction success.
    if (!hasSubstantialExtraction(mapped)) throw new UnderstandingFailure('We couldn’t find enough bill details in these documents.', 'no_details');
    onPhase('organizing');
    const recovered = await recoverBillDates(request, mapped, deps.appendPart, signal, deps.markDateRecovery);
    throwIfAborted(signal);
    const auditId = mapped.extraction.auditId;
    if (auditId && mapped.lineItems.length) void (deps.resolveVoice ?? voiceKeyFor)(deps.currentVoice?.() ?? 'calm', mapped.extraction.language ?? backendLocale(request.workingLanguage))
      .then(voice => { if (!signal.aborted) return (deps.prepare ?? prepareSpeech)(auditId, voice); }).catch(() => {});
    return { mode: 'extracted', contextId: auditId, details: {
      ...(mapped.provider ? { provider: mapped.provider } : {}),
      ...(mapped.serviceDate && isISODate(mapped.serviceDate) ? { serviceDate: mapped.serviceDate } : {}),
      financials: mapped.financials, lineItems: mapped.lineItems, extraction: mapped.extraction, findings: mapped.findings, ...recovered,
    } };
  } };
}
