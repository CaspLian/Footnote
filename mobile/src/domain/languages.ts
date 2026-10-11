/** Curated intersection of ElevenAgents model coverage and Apple's app localization locales.
 * The choice controls bundled UI catalogs and connected document/agent requests.
 * Flags represent a familiar region; the visible native language name is authoritative. */
export const workingLanguages = [
  { code: 'en', agentCode: 'en', name: 'English', native: 'English', country: 'us', locale: 'en-US' },
  { code: 'es', agentCode: 'es', name: 'Spanish', native: 'Español', country: 'es', locale: 'es-ES' },
  { code: 'fr', agentCode: 'fr', name: 'French', native: 'Français', country: 'fr', locale: 'fr-FR' },
  { code: 'de', agentCode: 'de', name: 'German', native: 'Deutsch', country: 'de', locale: 'de-DE' },
  { code: 'it', agentCode: 'it', name: 'Italian', native: 'Italiano', country: 'it', locale: 'it-IT' },
  { code: 'zh-Hans', agentCode: 'zh', name: 'Chinese · Simplified', native: '简体中文', country: 'cn', locale: 'zh-Hans' },
  { code: 'zh-Hant', agentCode: 'zh', name: 'Chinese (Taiwan)', native: '中文（台灣）', country: 'tw', locale: 'zh-Hant-TW' },
  { code: 'ja', agentCode: 'ja', name: 'Japanese', native: '日本語', country: 'jp', locale: 'ja-JP' },
  { code: 'ko', agentCode: 'ko', name: 'Korean', native: '한국어', country: 'kr', locale: 'ko-KR' },
  { code: 'hi', agentCode: 'hi', name: 'Hindi', native: 'हिन्दी', country: 'in', locale: 'hi-IN' },
  { code: 'ar', agentCode: 'ar', name: 'Arabic', native: 'العربية', country: 'sa', locale: 'ar-SA' },
  { code: 'he', agentCode: 'he', name: 'Hebrew', native: 'עברית', country: 'il', locale: 'he-IL' },
  { code: 'nl', agentCode: 'nl', name: 'Dutch', native: 'Nederlands', country: 'nl', locale: 'nl-NL' },
  { code: 'sv', agentCode: 'sv', name: 'Swedish', native: 'Svenska', country: 'se', locale: 'sv-SE' },
  { code: 'da', agentCode: 'da', name: 'Danish', native: 'Dansk', country: 'dk', locale: 'da-DK' },
  { code: 'fi', agentCode: 'fi', name: 'Finnish', native: 'Suomi', country: 'fi', locale: 'fi-FI' },
  { code: 'no', agentCode: 'no', name: 'Norwegian', native: 'Norsk', country: 'no', locale: 'nb-NO' },
  { code: 'pl', agentCode: 'pl', name: 'Polish', native: 'Polski', country: 'pl', locale: 'pl-PL' },
  { code: 'cs', agentCode: 'cs', name: 'Czech', native: 'Čeština', country: 'cz', locale: 'cs-CZ' },
  { code: 'sk', agentCode: 'sk', name: 'Slovak', native: 'Slovenčina', country: 'sk', locale: 'sk-SK' },
  { code: 'hu', agentCode: 'hu', name: 'Hungarian', native: 'Magyar', country: 'hu', locale: 'hu-HU' },
  { code: 'ro', agentCode: 'ro', name: 'Romanian', native: 'Română', country: 'ro', locale: 'ro-RO' },
  { code: 'el', agentCode: 'el', name: 'Greek', native: 'Ελληνικά', country: 'gr', locale: 'el-GR' },
  { code: 'ru', agentCode: 'ru', name: 'Russian', native: 'Русский', country: 'ru', locale: 'ru-RU' },
  { code: 'uk', agentCode: 'uk', name: 'Ukrainian', native: 'Українська', country: 'ua', locale: 'uk-UA' },
  { code: 'tr', agentCode: 'tr', name: 'Turkish', native: 'Türkçe', country: 'tr', locale: 'tr-TR' },
  { code: 'id', agentCode: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', country: 'id', locale: 'id-ID' },
  { code: 'ms', agentCode: 'ms', name: 'Malay', native: 'Bahasa Melayu', country: 'my', locale: 'ms-MY' },
  { code: 'th', agentCode: 'th', name: 'Thai', native: 'ไทย', country: 'th', locale: 'th-TH' },
  { code: 'vi', agentCode: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', country: 'vn', locale: 'vi-VN' },
  { code: 'pt-PT', agentCode: 'pt', name: 'Portuguese', native: 'Português', country: 'pt', locale: 'pt-PT' },
] as const;
export type WorkingLanguage = typeof workingLanguages[number]['code'];
export function languageOption(code: unknown) { return workingLanguages.find(option => option.code === (code === 'pt-BR' ? 'pt-PT' : code)) ?? workingLanguages[0]; }
