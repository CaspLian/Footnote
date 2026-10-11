import type { GeminiAnalyzeResponse } from '../domain/extraction';
import type { BackendSpeech } from './backend';
import { backendLocale, call, BackendError } from './backend';
import type { WorkingLanguage } from '../domain/languages';
import type { VoiceChoice } from '../domain/preferences';
import { voiceKeyFor } from './voice-catalog';
export interface RecordedAnswer { transcript: { text: string; needs_confirmation?: boolean }; analysis: GeminiAnalyzeResponse; speech: BackendSpeech }
export async function askRecordedQuestion(recording: Blob, language: WorkingLanguage, voice: VoiceChoice, signal: AbortSignal): Promise<RecordedAnswer> {
  signal.throwIfAborted();
  if (!recording.size || recording.size > 20 * 1024 * 1024) throw new Error('Record a short question, then try again.');
  const locale = backendLocale(language), key = await voiceKeyFor(voice, locale);
  signal.throwIfAborted();
  const form = new FormData();
  form.append('audio', recording, recording.type.includes('webm') ? 'question.webm' : 'question.m4a');
  form.append('target_language', locale); if (key) form.append('voice', key);
  form.append('speak_reply', 'true');
  try { return await call<RecordedAnswer>('/api/v1/voice/analyze', { method: 'POST', body: form }, 180_000, signal); }
  catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof BackendError && error.message === 'unreachable') throw new Error('Could not reach ClaimPulse. Your question could not be sent. Check the connection and try again.');
    if (error instanceof BackendError && error.message === 'timeout') throw new Error('The question took too long to answer. Try a shorter recording.');
    throw error;
  }
}
