import type { Language } from '@/domain';
import { NativeActionError } from './errors';

export type NarrationStatus = 'idle' | 'loading' | 'speaking' | 'unavailable' | 'error';
export type NarrationSnapshot = { status: NarrationStatus; error?: NativeActionError };
export type DeviceVoice = { identifier: string; language: string; quality?: string };
export type SpeechAdapter = {
  getVoices(): Promise<DeviceVoice[]>;
  stop(): Promise<void>;
  start(text: string, options: {
    language: string;
    voice: string;
    onStart(): void;
    onDone(): void;
    onStopped(): void;
    onError(error: unknown): void;
  }): void;
  maxLength: number;
};

export function chooseDeviceVoice(voices: DeviceVoice[], language: Language): DeviceVoice | undefined {
  const desired = language === 'es' ? 'es-US' : 'en-US';
  const normalize = (value: string) => value.replace(/_/g, '-').toLowerCase();
  const matching = voices.filter(voice => normalize(voice.language).split('-')[0] === language);
  return matching.find(voice => normalize(voice.language) === normalize(desired) && voice.quality === 'Enhanced')
    ?? matching.find(voice => normalize(voice.language) === normalize(desired))
    ?? matching.find(voice => voice.quality === 'Enhanced')
    ?? matching[0];
}

export function splitNarrationText(text: string, maxLength: number): string[] {
  const remaining: string[] = [];
  let rest = text.trim();
  const limit = Math.max(1, Math.floor(maxLength));
  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    const lastBreak = Math.max(window.lastIndexOf('\n'), window.lastIndexOf('. '), window.lastIndexOf(' '));
    let end = lastBreak > limit / 2 ? lastBreak + 1 : limit;
    // Keep UTF-16 surrogate pairs together at an input-length boundary.
    if (/[\uD800-\uDBFF]/.test(rest[end - 1]) && end < rest.length) end--;
    if (!end) end = Math.min(2, rest.length);
    remaining.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) remaining.push(rest);
  return remaining;
}

/** Single owner for the device queue. Generation guards prevent a cancelled async start. */
export class NarrationController {
  private generation = 0;
  private snapshot: NarrationSnapshot = { status: 'idle' };
  private listeners = new Set<() => void>();

  constructor(private readonly adapter: SpeechAdapter) {}

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private update(snapshot: NarrationSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach(listener => listener());
  }

  async stop(): Promise<void> {
    this.generation++;
    this.update({ status: 'idle' });
    await this.adapter.stop();
  }

  async speak(text: string, language: Language): Promise<void> {
    const generation = ++this.generation;
    this.update({ status: 'loading' });
    try {
      await this.adapter.stop();
      if (generation !== this.generation) return;
      const voices = await this.adapter.getVoices();
      if (generation !== this.generation) return;
      const voice = chooseDeviceVoice(voices, language);
      if (!voice) {
        const error = new NativeActionError('voice-unavailable');
        this.update({ status: 'unavailable', error });
        throw error;
      }
      const chunks = splitNarrationText(text, Math.min(this.adapter.maxLength, 4000));
      if (!chunks.length) {
        this.update({ status: 'idle' });
        return;
      }
      let index = 0;
      const speakNext = () => {
        if (generation !== this.generation) return;
        this.adapter.start(chunks[index], {
          language: voice.language,
          voice: voice.identifier,
          onStart: () => {
            if (generation === this.generation) this.update({ status: 'speaking' });
          },
          onDone: () => {
            if (generation !== this.generation) return;
            if (++index < chunks.length) {
              try { speakNext(); } catch {
                this.update({ status: 'error', error: new NativeActionError('narration-failed') });
              }
            } else this.update({ status: 'idle' });
          },
          onStopped: () => {
            if (generation === this.generation) this.update({ status: 'idle' });
          },
          onError: () => {
            if (generation !== this.generation) return;
            this.update({ status: 'error', error: new NativeActionError('narration-failed') });
          },
        });
      };
      speakNext();
    } catch (error) {
      if (generation !== this.generation) return;
      if (error instanceof NativeActionError) throw error;
      const failure = new NativeActionError('narration-failed');
      this.update({ status: 'error', error: failure });
      throw failure;
    }
  }
}
