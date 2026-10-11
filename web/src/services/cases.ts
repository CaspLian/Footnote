import type { Language } from '../types';
import { backend as defaultBackend, type Backend, type ClaimIn } from './backend';
import { LOCALE_FOR, toConnectedCase, type ConnectedCase } from './analysis-mapping';
import { readings as defaultReadings, type Readings } from './reading';

export interface CaseServices {
  api?: Backend;
  readings?: Readings;
}

/**
 * Bill pages (photos or PDFs, in order) -> Gemini -> Medicare price check -> a case for the app's screens.
 * The ElevenLabs reading of the summary starts at once, so Listen on the review plays without waiting.
 * Rejects with a BackendError: `status` 0 when the backend is not set or not reachable, 400 for a file type or
 * language it refuses, 502/504 when Gemini failed or took too long.
 */
export async function analyzeDocuments(
  files: File[],
  language: Language,
  options: { text?: string } & CaseServices = {},
): Promise<ConnectedCase> {
  const api = options.api ?? defaultBackend;
  const response = await api.analyze(files, { language: LOCALE_FOR[language], text: options.text });
  const connected = toConnectedCase(response, files, language);
  if (connected.audit_id) void (options.readings ?? defaultReadings).prepare(connected.audit_id).catch(() => undefined);
  return connected;
}

/** What POST /api/v1/claims needs from a case the user has confirmed: its lines and dates, linked to the analysis. */
export function claimFromCase(confirmed: ConnectedCase, serviceDateIso?: string): ClaimIn {
  return {
    items: confirmed.line_items
      .filter(item => item.cpt_code && item.hospital_amount != null && item.hospital_amount >= 0)
      .map(item => ({ code: item.cpt_code, description: item.description, amount: item.hospital_amount! })),
    provider_name: confirmed.provider_name,
    ...(serviceDateIso ? { service_date: serviceDateIso } : {}),
    ...(confirmed.total_billed != null ? { total_billed: confirmed.total_billed } : {}),
    ...(confirmed.audit_id ? { analysis_audit_id: confirmed.audit_id } : {}),
  };
}
