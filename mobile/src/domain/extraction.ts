import type { BillCase, DocumentAttachment, Evidence, ExtractedAnalysis, Finding, Language, LineItem, LocalizedText } from './types';
import { analysisFingerprint } from './analysis-provenance';
import { isISODate } from './money';

export interface GeminiLineItem {
  cpt_code?: string | null;
  original_description: string;
  plain_description: string;
  billed_amount?: number | null;
  date_of_service?: string | null;
  source_page?: number | null;
  possible_issues?: string[];
}

export interface GeminiAnalyzeResponse {
  model: string;
  mock: boolean;
  target_language: string;
  result: {
    document_type: string;
    provider_name?: string | null;
    total_billed?: number | null;
    amount_patient_owes?: number | null;
    due_date?: string | null;
    line_items: GeminiLineItem[];
    plain_summary: string;
    spoken_summary: string;
    questions_to_ask: string[];
  };
  price_checks: { line_index: number; flag: string; note: string; cpt_code?: string | null; billed_amount?: number | null; medicare_rate?: number | null }[];
  /** Whether the backend saved the analysis (Tiger Data); its id lets the review play the ElevenLabs reading. */
  audit?: { saved: boolean; audit_id: string | null; error: string | null } | null;
}

const localized = (value: string, _language: Language): LocalizedText => ({ en: value, es: value });
const cents = (amount?: number | null) => {
  if (amount == null || !Number.isFinite(amount) || amount < 0) return undefined;
  const value = Math.round(amount * 100);
  return Number.isSafeInteger(value) ? value : undefined;
};

export function mapGeminiAnalysis(response: GeminiAnalyzeResponse, billCase: Pick<BillCase, 'attachments'>, language: Language): { extraction: ExtractedAnalysis; provider?: string; serviceDate?: string; financials: Partial<BillCase['financials']>; lineItems: LineItem[]; findings: Finding[] } {
  const result = response.result;
  const attachments = billCase.attachments.filter(item => item.origin === 'import');
  const firstAttachment: DocumentAttachment | undefined = attachments[0];
  const lineItems = result.line_items.map((line, index): LineItem => {
    const pageNumber = Number.isSafeInteger(line.source_page) && line.source_page! > 0 && line.source_page! <= attachments.length ? line.source_page! : undefined;
    const attachment = pageNumber ? attachments[pageNumber - 1] ?? firstAttachment : firstAttachment;
    const description = line.original_description || line.plain_description;
    const sourceText = [line.date_of_service, line.cpt_code, description, line.billed_amount == null ? '' : `$${line.billed_amount.toFixed(2)}`].filter(Boolean).join(' · ');
    const evidence: Evidence = { attachmentId: attachment?.id ?? '', page: pageNumber ?? 1, label: localized(`Line ${index + 1} · ${attachment ? (pageNumber ? `page ${pageNumber} · ${attachment.name}` : `${attachment.name} · source page not identified`) : 'imported document'}`, language), excerpt: localized(sourceText, language) };
    const billed = cents(line.billed_amount);
    return { id: `gemini-line-${index + 1}`, description: localized(description, language), code: line.cpt_code ?? undefined, date: line.date_of_service ?? '', units: 1, billedCents: billed ?? 0, amountMissing: billed === undefined, evidence };
  });
  const issues = result.line_items.flatMap((line, index) => (line.possible_issues ?? []).map(issue => ({ index, issue })));
  // The same notes by line id, so the review can attach each question to its line's evidence.
  const notes: Record<string, string[]> = {};
  for (const { index, issue } of issues) if (issue.trim()) (notes[lineItems[index].id] ??= []).push(issue);
  const flaggedChecks = response.price_checks.filter(check => !['typical', 'no_code', 'no_benchmark', 'no_amount'].includes(check.flag));
  const findings: Finding[] = [
    ...issues.map(({ index, issue }, n): Finding => ({
      id: `gemini-question-${n + 1}`, title: localized('Ask about this charge', language), explanation: localized(issue, language),
      question: localized(issue, language), label: 'worth_asking', evidence: lineItems[index]?.evidence ? [lineItems[index].evidence] : [], action: 'billing_correction',
    })),
    ...flaggedChecks.map((check, index): Finding => ({
      id: `benchmark-question-${index + 1}`, title: localized('Ask about this comparison', language), explanation: localized(check.note, language),
      question: localized(check.note, language), label: 'worth_asking', evidence: [], action: 'billing_correction',
    })),
  ];
  const totalBilledCents = cents(result.total_billed);
  const patientOwesCents = cents(result.amount_patient_owes);
  const extraction: ExtractedAnalysis = {
    language: response.target_language,
    model: response.model,
    mock: response.mock,
    documentType: result.document_type,
    summary: localized(result.plain_summary, language),
    questions: result.questions_to_ask.map(question => localized(question, language)),
    issues: [...issues.map(item => localized(item.issue, language)), ...flaggedChecks.map(item => localized(item.note, language))],
    totalBilledCents,
    patientOwesCents,
    dueDate: result.due_date ?? undefined,
    auditId: response.audit?.saved && response.audit.audit_id ? response.audit.audit_id : undefined,
    notes,
    parsedAt: new Date().toISOString(),
  };
  const mapped = {
    extraction,
    provider: result.provider_name ?? undefined,
    serviceDate: lineItems.find(line => line.date)?.date,
    financials: {
      ...(totalBilledCents === undefined ? {} : { billedCents: totalBilledCents }),
      ...(patientOwesCents === undefined ? {} : { remainingCents: patientOwesCents }),
    },
    lineItems,
    findings,
  };
  extraction.inputFingerprint = analysisFingerprint({ provider: mapped.provider ?? '', serviceDate: isISODate(mapped.serviceDate ?? '') ? mapped.serviceDate! : '', financials: mapped.financials, lineItems });
  return mapped;
}
