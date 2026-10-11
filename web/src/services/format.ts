import type { Language } from '../types';

/** Missing document amounts stay unknown; a documented zero is still $0.00. */
export function formatMoney(value: number | null | undefined, language: Language): string {
  if (value == null || !Number.isFinite(value)) return language === 'es' ? 'No disponible' : 'Not available';
  return new Intl.NumberFormat(language === 'es' ? 'es-US' : 'en-US', {
    style: 'currency', currency: 'USD',
  }).format(value);
}
