import type { VoiceChoice } from '../domain/preferences';
import { backendConfigured, voices, type BackendVoiceCatalog } from './backend';

type CatalogVoice = BackendVoiceCatalog['voices'][number];
export const SLOT_VOICES = { clear: 'alice', warm: 'george' } as const;
// ElevenLabs' codes for a language where they differ from the app's (Norwegian is "no", Filipino's base "tl").
const ALIASES: Record<string, string> = { no: 'nb', tl: 'fil', iw: 'he' };
const languageOf = (code: string) => { const base = code.toLowerCase().split('-')[0]; return ALIASES[base] ?? base; };

/** ElevenLabs verified this voice speaking the locale's language (the accent is in the entry). */
export function verifiedFor(voice: CatalogVoice, locale: string) {
  const language = languageOf(locale);
  return voice.verified_languages?.filter(item => languageOf(item.language) === language) ?? [];
}
/** A voice listed without verified languages is trusted with English only. */
export const speaksLocale = (voice: CatalogVoice, locale: string) => voice.verified_languages?.length ? verifiedFor(voice, locale).length > 0 : languageOf(locale) === 'en';

function languageDefault(locale: string, catalog: BackendVoiceCatalog): string {
  const defaults = new Map(Object.entries(catalog.language_defaults).map(([key, value]) => [key.toLowerCase(), value]));
  const normalized = locale.toLowerCase();
  const speaks = (key?: string) => { const voice = catalog.voices.find(v => v.key === key); return voice && speaksLocale(voice, locale) ? voice.key : undefined; };
  return speaks(defaults.get(normalized)) ?? speaks(defaults.get(normalized.split('-')[0])) ?? speaks(catalog.default)
    ?? catalog.voices.find(voice => speaksLocale(voice, locale))?.key ?? catalog.default;
}
/** The voice that speaks this locale for a choice: the chosen voice only if it is verified for the language, so a
 *  voice picked for one language never reads another with a foreign accent; otherwise the language's default. */
export function resolveVoiceKey(choice: VoiceChoice, locale: string, catalog: BackendVoiceCatalog): string {
  const calm = languageDefault(locale, catalog);
  const desired = choice.startsWith('provider:') ? choice.slice('provider:'.length) : choice === 'clear' || choice === 'warm' ? SLOT_VOICES[choice] : calm;
  const voice = catalog.voices.find(item => item.key === desired);
  return voice && speaksLocale(voice, locale) ? voice.key : calm;
}
/** Only provider-verified language choices; multilingual model support alone is not verification. The language's
 *  default comes first, then voices verified for this exact locale (e.g. Mexican Spanish for es-MX). */
export function voicesForLocale(locale: string, catalog: BackendVoiceCatalog) {
  const recommended = languageDefault(locale, catalog);
  const exact = (voice: CatalogVoice) => verifiedFor(voice, locale).some(item => item.locale?.toLowerCase() === locale.toLowerCase());
  return catalog.voices.filter(voice => verifiedFor(voice, locale).length > 0)
    .sort((a, b) => Number(b.key === recommended) - Number(a.key === recommended) || Number(exact(b)) - Number(exact(a)));
}
/** How the voice sounds in this language, from its verified entry: "Mexican", "Quebec", "Standard". */
export function accentFor(voice: CatalogVoice, locale: string): string | undefined {
  const entries = verifiedFor(voice, locale);
  const entry = entries.find(item => item.locale?.toLowerCase() === locale.toLowerCase()) ?? entries[0];
  const accent = entry?.accent?.trim();
  if (!accent || accent === 'other') return undefined;
  // "es-mexican" -> "Mexican"; "ar-modern-standard" -> "Modern standard"
  const words = accent.replace(new RegExp(`^${languageOf(locale)}-|^${entry!.language.toLowerCase()}-`, 'i'), '').replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
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
