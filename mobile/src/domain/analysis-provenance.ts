import type { BillCase } from './types';
/** Stable source-input comparison, excluding UI labels, status, evidence captions and timestamps. */
export function analysisFingerprint(input: Pick<BillCase, 'provider' | 'serviceDate' | 'financials' | 'lineItems'>): string {
  return JSON.stringify({
    provider: input.provider.trim(), serviceDate: input.serviceDate,
    financials: Object.fromEntries(Object.entries(input.financials).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b))),
    lines: input.lineItems.map(line => ({ description: line.description.en.trim(), code: (line.code ?? '').trim().toUpperCase(), date: line.date, units: line.units, billedCents: line.amountMissing ? null : line.billedCents })),
  });
}
export function analysisChanged(input: BillCase): boolean {
  if (!input.extraction) return false;
  return input.extraction.inputFingerprint ? analysisFingerprint(input) !== input.extraction.inputFingerprint : !!input.entriesEdited;
}
