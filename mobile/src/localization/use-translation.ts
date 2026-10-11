import { useCallback } from 'react';
import { useFootnoteStore } from '../store';
import { translateText, languageDirection, languageLocale } from './translate';
export function useTranslation() {
  const language = useFootnoteStore(s => s.preferences.workingLanguage);
  const t = useCallback((text: string, values?: Record<string, string | number>) => translateText(text, language, values), [language]);
  return { t, language, direction: languageDirection(language), formatLocale: languageLocale(language) };
}
