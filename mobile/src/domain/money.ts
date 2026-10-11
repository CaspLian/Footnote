import type { Financials } from './types';

export function isMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function formatMoney(cents: number | undefined, language: string = 'en'): string {
  if (cents === undefined || !isMoney(cents)) return language === 'es' ? 'No indicado' : 'Not shown';
  return new Intl.NumberFormat(language === 'es' ? 'es-US' : language === 'en' ? 'en-US' : language, {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Both app languages use U.S. currency conventions: 1,234.56. */
export function parseMoney(value: string, _language: string = 'en'): number | null {
  const normalized = value.trim().replace(/^\$\s*/, '');
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [dollars, fraction = ''] = normalized.replaceAll(',', '').split('.');
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, '0'));
  return isMoney(cents) ? cents : null;
}

/** Derived from EOB responsibility and the payment recorded on the bill. */
export function expectedRemaining(financials: Financials): number | undefined {
  if (financials.eobResponsibilityCents === undefined) return undefined;
  if (!isMoney(financials.eobResponsibilityCents) || !isMoney(financials.patientPaidCents)) return undefined;
  return Math.max(0, financials.eobResponsibilityCents - financials.patientPaidCents);
}

/** Reconcile only provider-statement values; never subtract payments from an unrelated EOB. */
export function statementRemaining(financials: Financials): number | undefined {
  const { postAdjustmentCents, billedCents, adjustmentCents, insurerPaidCents, patientPaidCents } = financials;
  const subtotal = postAdjustmentCents ?? (isMoney(billedCents) && isMoney(adjustmentCents) ? billedCents! - adjustmentCents! : undefined);
  if (!isMoney(subtotal) || !isMoney(insurerPaidCents) || !isMoney(patientPaidCents)) return undefined;
  return Math.max(0, subtotal - insurerPaidCents! - patientPaidCents!);
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function formatDate(date: string | undefined, language: string = 'en'): string {
  if (!date) return language === 'es' ? 'No indicado' : 'Not shown';
  const parsed = new Date(date.length === 10 ? `${date}T12:00:00Z` : date);
  if (!Number.isFinite(parsed.getTime())) return language === 'es' ? 'No indicado' : 'Not shown';
  return new Intl.DateTimeFormat(language === 'es' ? 'es-US' : language === 'en' ? 'en-US' : language, {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(parsed);
}
