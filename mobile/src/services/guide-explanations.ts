import { glossary } from '../domain/glossary';
import type { ExplanationDepth, FamilyProfile, Language } from '../domain/types';
import type { VoiceChoice } from '../domain/preferences';

export interface GuideExplanationRequest {
  termId: string;
  language: Language;
  depth: ExplanationDepth;
  voice: VoiceChoice;
  /** Only pass optional context to a remote service with the user's consent. */
  coverage?: FamilyProfile['coverage'];
}
export interface GuideExplanation {
  termId: string;
  definition: string;
  example: string;
  question: string;
  narration: string;
  source: { title: string; url: string };
  provenance: 'curated_local';
}
export interface GuideExplanationService {
  prepare(request: GuideExplanationRequest): Promise<GuideExplanation>;
}
const questions: Record<string, string> = {
  eob: 'Does my provider’s statement match the responsibility and payments on this EOB?',
  'allowed-amount': 'Which allowed amount did you use for this service?',
  deductible: 'How much of this service was applied to my deductible?',
  coinsurance: 'Which amount and percentage were used to calculate my share?',
  copayment: 'Which copayment applies to this specific service?',
  'in-network': 'Were the facility and each clinician in my plan’s network on the date of care?',
  'itemized-bill': 'Can you send an itemized statement with the service dates, codes, units and adjustments?',
  appeal: 'Where are the review instructions and deadlines in my insurer’s decision notice?',
};
/** Curated explanations only. The future backend can return sourced explanations in this contract. */
export const guideExplanationService: GuideExplanationService = {
  async prepare(request) {
    const term = glossary.find(t => t.id === request.termId);
    if (!term) throw new Error('term_not_found');
    const definition = term.definition[request.language];
    const example = term.example[request.language];
    const question = request.language === 'en' ? questions[term.id] : '¿Puedes explicar cómo se aplicó esto a mi factura?';
    const narration = `${term.title[request.language]}. ${definition}${request.depth === 'detailed' ? ` For example. ${example} A useful question to ask. ${question}` : ''}`;
    return { termId: term.id, definition, example, question, narration, source: term.source, provenance: 'curated_local' };
  },
};
