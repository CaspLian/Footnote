import { backendUrl, speakAnalysis } from './backend';

// The ElevenLabs reading of each saved analysis, requested as soon as Gemini has read the pages (the processing
// screen) and again when the review opens, so "Listen" plays at once instead of waiting for the clip to be made
// (about 2 s on Flash v2.5, 8.5 s on Multilingual v2). The backend
// caches finished clips and lets identical requests share one generation, so asking twice is never paid twice.
const prepared = new Map<string, Promise<string>>();

/** Starts (or reuses) the reading of a saved analysis; resolves to the absolute URL of its MP3. */
export function prepareSpeech(auditId: string, voice?: string): Promise<string> {
  const key = `${auditId}|${voice ?? ''}`;
  let ready = prepared.get(key);
  if (!ready) {
    ready = speakAnalysis(auditId, voice).then(speech => {
      if (!speech.ok || !speech.audio_url) throw new Error(speech.error_code ?? 'no_audio');
      return backendUrl(speech.audio_url);
    });
    // A failure (offline, quota) is not remembered: the next request tries again.
    ready.catch(() => { if (prepared.get(key) === ready) prepared.delete(key); });
    prepared.set(key, ready);
  }
  return ready;
}
