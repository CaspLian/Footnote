import type { BillCase, Comparison, Finding, Language, LineItem, LocalizedText } from '../domain/types';
import type { BackendBenchmark } from './backend';

/** The backend's price data: CMS 2026 Physician Fee Schedule, national rates (not regional, not what you owe). */
export const MEDICARE_SOURCE = 'Medicare national rate (CMS 2026 Physician Fee Schedule)';
export const MEDICARE_URL = 'https://www.cms.gov/medicare/payment/fee-schedules/physician';
/** Above this many times Medicare's rate a line becomes a question worth asking (the backend's "above typical"). */
export const WORTH_ASKING_RATIO = 3;

// Gemini answers in one language; the app writes manual entries to both languages the same way.
const same = (value: string): LocalizedText => ({ en: value, es: value });

export function dollarsToCents(value: number | null | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) ? cents : undefined;
}

/** The same normalisation as the backend's price check: the first 5 letters or digits. */
export function normalizeCode(code?: string): string | undefined {
  const cleaned = (code ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return cleaned.length >= 5 ? cleaned.slice(0, 5) : undefined;
}

function rateContext(setting: string | null, units: number): LocalizedText {
  const forUnits = units > 1 ? { en: ` for ${units} units`, es: ` por ${units} unidades` } : { en: '', es: '' };
  if (setting?.toLowerCase() === 'facility') {
    return {
      en: `What Medicare pays nationally for the doctor's part of this service${forUnits.en}. Hospitals usually bill a separate facility charge, so a higher total can be normal.`,
      es: `Lo que Medicare paga a nivel nacional por la parte del médico de este servicio${forUnits.es}. Los hospitales suelen cobrar aparte un cargo del centro, así que un total más alto puede ser normal.`,
    };
  }
  return {
    en: `What Medicare pays nationally for this service${forUnits.en}. Private insurers and providers often charge more; it is a reference, not what you owe.`,
    es: `Lo que Medicare paga a nivel nacional por este servicio${forUnits.es}. Las aseguradoras privadas y los proveedores suelen cobrar más; es una referencia, no lo que debes.`,
  };
}

/** Medicare's rate for a line, or null when the code has no rate (unknown is never zero). */
export function comparisonFor(line: LineItem, benchmark: BackendBenchmark | null | undefined, retrievedAt: string): Comparison | null {
  const rateCents = dollarsToCents(benchmark?.medicare_rate);
  if (!benchmark || !rateCents) return null;
  return { source: MEDICARE_SOURCE, url: MEDICARE_URL, amountCents: rateCents * line.units, retrievedAt, context: rateContext(benchmark.setting, line.units) };
}

function times(ratio: number, language: Language): string {
  const text = ratio >= 10 ? ratio.toFixed(0) : ratio.toFixed(1);
  return language === 'es' ? text.replace('.', ',') : text;
}

/** A question worth asking when a line is billed well above Medicare's rate; null otherwise. */
export function priceFinding(line: LineItem, comparison: Comparison): Finding | null {
  if (!line.code || line.billedCents <= 0 || comparison.amountCents <= 0) return null;
  const ratio = line.billedCents / comparison.amountCents;
  if (ratio <= WORTH_ASKING_RATIO) return null;
  return {
    id: `price-${line.id}`,
    title: {
      en: `${line.description.en || line.code} is billed at about ${times(ratio, 'en')} times Medicare's rate`,
      es: `${line.description.es || line.code} se facturó a unas ${times(ratio, 'es')} veces la tarifa de Medicare`,
    },
    explanation: {
      en: `${comparison.context.en} A difference is a reason to ask, not proof of an error.`,
      es: `${comparison.context.es} Una diferencia es un motivo para preguntar, no una prueba de un error.`,
    },
    question: {
      en: `Can you explain how the charge for code ${line.code} was priced, and send an itemized statement?`,
      es: `¿Pueden explicar cómo se calculó el cargo del código ${line.code} y enviar un estado de cuenta detallado?`,
    },
    label: 'worth_asking',
    evidence: [line.evidence],
    comparison,
    action: 'billing_correction',
  };
}

/** Gemini's own note on a line that looks off (a duplicate, a vague fee), as a question to clarify. */
export function noteFinding(line: LineItem, notes: string[]): Finding {
  return {
    id: `note-${line.id}`,
    title: same(notes[0]),
    explanation: same(notes.join(' ')),
    question: {
      en: `Can you explain this line on my statement: "${line.evidence.excerpt.en}"?`,
      es: `¿Pueden explicar esta línea de mi estado de cuenta: "${line.evidence.excerpt.es}"?`,
    },
    label: 'needs_clarification',
    evidence: [line.evidence],
    action: 'billing_correction',
  };
}

/** The review's findings for the user's confirmed lines: Gemini's notes first, then the price comparisons. */
export function reviewFindings(billCase: BillCase, benchmarks: Map<string, BackendBenchmark>, retrievedAt: string): Finding[] {
  const findings: Finding[] = [];
  for (const line of billCase.lineItems) {
    const notes = billCase.extraction?.notes?.[line.id];
    if (notes?.length) findings.push(noteFinding(line, notes));
    const code = normalizeCode(line.code);
    const comparison = code ? comparisonFor(line, benchmarks.get(code), retrievedAt) : null;
    const price = comparison ? priceFinding(line, comparison) : null;
    if (price) findings.push(price);
  }
  return findings;
}
