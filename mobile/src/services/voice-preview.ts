import type { WorkingLanguage } from '../domain/languages';
import type { VoiceChoice } from '../domain/preferences';
export interface VoicePreviewAdapter { play(voice: VoiceChoice, language: WorkingLanguage): Promise<{ stop(): Promise<void>; finished?: Promise<void> }>; }
let adapter: VoicePreviewAdapter = { async play() { throw new Error('Voice samples aren’t connected yet. This selection saves your preferred ElevenLabs agent voice; it won’t play a different device voice.'); } };
export function configureVoicePreviewAdapter(next: VoicePreviewAdapter) { adapter = next; }
export const voicePreviewService: VoicePreviewAdapter = { play: (voice, language) => adapter.play(voice, language) };
