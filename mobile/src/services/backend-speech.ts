import { backendUrl, speakAnalysis } from './backend';

// The ElevenLabs reading of each saved analysis, requested as soon as the analysis exists (intake) and again when
// the review opens, so "Listen" plays at once instead of waiting about 9 s for the clip to be made. The backend
// caches finished clips and lets identical requests share one generation, so asking twice is never paid twice.
const prepared = new Map<string, Promise<string>>();

/** Starts (or reuses) the reading of a saved analysis; resolves to the absolute URL of its MP3. */
export function prepareSpeech(auditId: string): Promise<string> {
  let ready = prepared.get(auditId);
  if (!ready) {
    ready = speakAnalysis(auditId).then(speech => {
      if (!speech.ok || !speech.audio_url) throw new Error(speech.error_code ?? 'no_audio');
      return backendUrl(speech.audio_url);
    });
    // A failure (offline, quota) is not remembered: the next request tries again.
    ready.catch(() => { if (prepared.get(auditId) === ready) prepared.delete(auditId); });
    prepared.set(auditId, ready);
  }
  return ready;
}
