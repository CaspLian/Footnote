import type { WorkingLanguage } from '../domain/languages';
import type { VoiceChoice } from '../domain/preferences';
export interface VoicePreviewAdapter { play(voice: VoiceChoice, language: WorkingLanguage, options?: { signal?: AbortSignal }): Promise<{ stop(): Promise<void>; finished?: Promise<void> }>; }
let adapter: VoicePreviewAdapter = { async play() { throw new Error('Voice previews are unavailable. Check the connection and try again.'); } };
export function configureVoicePreviewAdapter(next: VoicePreviewAdapter) { adapter = next; }
export const voicePreviewService: VoicePreviewAdapter = { play: (voice, language, options) => adapter.play(voice, language, options) };
