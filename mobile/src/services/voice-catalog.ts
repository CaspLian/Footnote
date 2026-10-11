import type { VoiceChoice } from '../domain/preferences';
import { backendConfigured, voices, type BackendVoiceCatalog } from './backend';

export const SLOT_VOICES = { clear: 'alice', warm: 'george' } as const;
export function resolveVoiceKey(choice: VoiceChoice, locale: string, catalog: BackendVoiceCatalog): string {
  const defaults = new Map(Object.entries(catalog.language_defaults).map(([key, value]) => [key.toLowerCase(), value]));
  const normalized = locale.toLowerCase();
  const calm = defaults.get(normalized) ?? defaults.get(normalized.split('-')[0]) ?? catalog.default;
  if (choice.startsWith('provider:')) {
    const key = choice.slice('provider:'.length);
    return catalog.voices.some(voice => voice.key === key) ? key : calm;
  }
  const desired = choice === 'clear' || choice === 'warm' ? SLOT_VOICES[choice] : calm;
  return catalog.voices.some(voice => voice.key === desired) ? desired : calm;
}
/** Only provider-verified language choices; multilingual model support alone is not verification. */
export function voicesForLocale(locale: string, catalog: BackendVoiceCatalog) {
  const recommended = resolveVoiceKey('calm', locale, catalog);
  const language = locale.toLowerCase().split('-')[0];
  return catalog.voices.filter(voice => voice.verified_languages?.some(item => item.language.toLowerCase() === language))
    .sort((a, b) => Number(b.key === recommended) - Number(a.key === recommended));
}
let loading: Promise<BackendVoiceCatalog> | undefined;
export function loadVoiceCatalog(refresh = false): Promise<BackendVoiceCatalog> {
  if (refresh) loading = undefined;
  loading ??= voices();
  const pending = loading;
  pending.catch(() => { if (loading === pending) loading = undefined; });
  return pending;
}
export async function voiceKeyFor(choice: VoiceChoice, locale: string): Promise<string | undefined> {
  if (!backendConfigured()) return undefined;
  try { return resolveVoiceKey(choice, locale, await loadVoiceCatalog()); } catch { return undefined; }
}
