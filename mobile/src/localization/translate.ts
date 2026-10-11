import { catalogs } from './catalogs';
import { languageOption } from '../domain/languages';
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = Object.keys(catalogs.en).filter(key => /\{\d+\}/.test(key) && key.replace(/\{\d+\}/g, '').length >= 8).map(key => {
  const indices: number[] = [];
  const parts = key.split(/(\{\d+\})/);
  const regex = new RegExp('^' + parts.map(part => /^\{\d+\}$/.test(part) ? (indices.push(Number(part.slice(1,-1))), '(.*?)') : escape(part)).join('') + '$');
  return { key, indices, regex };
});
/** Catalog-only lookup: unknown user/evidence text is returned verbatim. No network or model runs here. */
export function translateText(text: string, language: string, values?: Record<string, string | number>): string {
  const code = languageOption(language).code;
  if (values) return (catalogs[code]?.[normalize(text)] ?? text).replace(/\{(\d+)\}/g, (token, index: string) => String(values[index] ?? token));
  if (code === 'en' || !text.trim()) return text;
  const catalog = catalogs[code];
  if (!catalog) return text;
  const key = normalize(text);
  let translated = catalog[key];
  if (!translated) for (const pattern of patterns) {
    const match = pattern.regex.exec(key);
    if (!match || !catalog[pattern.key]) continue;
    const params = new Map(pattern.indices.map((index,i) => [index,match[i+1]]));
    translated = catalog[pattern.key].replace(/\{(\d+)\}/g, (_token,index:string) => params.get(Number(index)) ?? '');
    break;
  }
  return translated ? (text.match(/^\s*/)?.[0] ?? '') + translated + (text.match(/\s*$/)?.[0] ?? '') : text;
}
export function languageDirection(language: string): 'rtl' | 'ltr' { return language === 'ar' || language === 'he' ? 'rtl' : 'ltr'; }
export function languageLocale(language: string) { return languageOption(language).locale; }
