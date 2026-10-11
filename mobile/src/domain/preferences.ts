import { languageOption, type WorkingLanguage } from './languages';
export type AppTheme = 'system' | 'light' | 'dark';
export type VoiceChoice = 'device' | 'calm' | 'clear' | 'warm' | `provider:${string}`;
export type BillSort = 'recent' | 'balance' | 'follow_up';
export interface AppPreferences {
  theme: AppTheme;
  workingLanguage: WorkingLanguage;
  voice: VoiceChoice;
  speechRate: number;
  haptics: boolean;
  reduceMotion: boolean;
  billSort: BillSort;
  showResolved: boolean;
}
export const defaultPreferences: AppPreferences = {
  theme: 'system', workingLanguage: 'en', voice: 'calm', speechRate: 0.92,
  haptics: true, reduceMotion: false, billSort: 'recent', showResolved: true,
};
/** Local slots for a future ElevenLabs voice catalog; these are not provider voice IDs. */
export const voiceChoices = [
  { id: 'device', name: 'Device voice', detail: 'Available now · works without an account' },
  { id: 'calm', name: 'Calm', detail: 'ElevenLabs placeholder · steady and reassuring' },
  { id: 'clear', name: 'Clear', detail: 'ElevenLabs placeholder · crisp and conversational' },
  { id: 'warm', name: 'Warm', detail: 'ElevenLabs placeholder · gentle and friendly' },
] as const;

/** Old snapshots and unknown future values recover to supported preferences. */
export function normalizePreferences(value: unknown): AppPreferences {
  const v = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    workingLanguage: languageOption(v.workingLanguage).code,
    theme: ['system', 'light', 'dark'].includes(v.theme as string) ? v.theme as AppTheme : 'system',
    voice: voiceChoices.some(choice => choice.id === v.voice) || typeof v.voice === 'string' && /^provider:[a-z0-9_]{1,64}$/.test(v.voice) ? v.voice as VoiceChoice : 'device',
    speechRate: [0.75, 0.92, 1.1].includes(v.speechRate as number) ? v.speechRate as number : 0.92,
    haptics: typeof v.haptics === 'boolean' ? v.haptics : true,
    reduceMotion: typeof v.reduceMotion === 'boolean' ? v.reduceMotion : false,
    billSort: ['recent', 'balance', 'follow_up'].includes(v.billSort as string) ? v.billSort as BillSort : 'recent',
    showResolved: typeof v.showResolved === 'boolean' ? v.showResolved : true,
  };
}
