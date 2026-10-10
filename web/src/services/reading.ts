import { backend as defaultBackend, BackendError, type Backend } from './backend';

/** An ElevenLabs reading: where to play it, and exactly what the voice says (for captions). */
export interface Reading {
  url: string;
  text: string;
  voice: string | null;
}

export interface Readings {
  /** Starts (or reuses) the reading of a saved analysis. Rejects with a BackendError when there is no audio. */
  prepare(auditId: string, voice?: string): Promise<Reading>;
}

/**
 * Readings of saved analyses, asked for early (right after the analysis) and reused, so "Listen" plays at once, as
 * in the mobile app (mobile/src/services/backend-speech.ts). The backend caches finished clips and shares identical
 * requests, so asking twice is never paid twice. A failure is not remembered: the next request tries again.
 */
export function createReadings(api: Backend): Readings {
  const prepared = new Map<string, Promise<Reading>>();
  return {
    prepare(auditId, voice) {
      const key = `${auditId}|${voice ?? ''}`;
      let ready = prepared.get(key);
      if (!ready) {
        ready = api.speak(auditId, voice).then(speech => {
          if (!speech.ok || !speech.audio_url) throw new BackendError(200, speech.error_code ?? 'no_audio', 'text_to_speech');
          return { url: api.url(speech.audio_url), text: speech.text ?? '', voice: speech.voice };
        });
        const current = ready;
        current.catch(() => {
          if (prepared.get(key) === current) prepared.delete(key);
        });
        prepared.set(key, current);
      }
      return ready;
    },
  };
}

export const readings: Readings = createReadings(defaultBackend);
