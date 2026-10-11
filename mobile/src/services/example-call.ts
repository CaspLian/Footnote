import { call } from './backend';

/** A short example phone call about a saved bill, performed by two ElevenLabs voices (POST /api/v1/voice/example-call). */
export interface ExampleCall {
  audio_url: string;
  mime_type: string;
  turns: { speaker: 'representative' | 'patient'; text: string }[];
  voices: { patient: string; representative: string };
  counterpart: 'billing' | 'insurer';
}
export const EXAMPLE_CALL_TIMEOUT_MS = 120_000; // Gemini writes it, then Text to Dialogue performs about 20 s of audio
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only a saved, unedited document reading can be acted out: confirmed corrections would make it describe old amounts. */
export const canHearExampleCall = (c: { evidenceContextId?: string; entriesEdited?: boolean }) => !!c.evidenceContextId && UUID.test(c.evidenceContextId) && !c.entriesEdited;

export function requestExampleCall(auditId: string, locale: string, voice: string | undefined, counterpart: ExampleCall['counterpart'], signal?: AbortSignal): Promise<ExampleCall> {
  const form = new FormData();
  form.append('audit_id', auditId);
  form.append('target_language', locale);
  if (voice) form.append('voice', voice);
  form.append('counterpart', counterpart);
  return call<ExampleCall>('/api/v1/voice/example-call', { method: 'POST', body: form }, EXAMPLE_CALL_TIMEOUT_MS, signal);
}
