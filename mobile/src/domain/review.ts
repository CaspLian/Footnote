import { expectedRemaining, formatMoney, isISODate, isMoney } from './money';
import type { BillCase, Language } from './types';

export interface ValidationIssue { field: string; key: 'required' | 'invalidDate' | 'invalidMoney' | 'invalidUnits' }

export function validateCase(billCase: BillCase): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!billCase.provider.trim()) issues.push({ field: 'provider', key: 'required' });
  if (!isISODate(billCase.serviceDate)) issues.push({ field: 'serviceDate', key: 'invalidDate' });
  for (const [field, value] of Object.entries(billCase.financials)) {
    if (value !== undefined && !isMoney(value)) issues.push({ field, key: 'invalidMoney' });
  }
  for (const line of billCase.lineItems) {
    if (line.amountMissing) issues.push({ field: `${line.id}.billedCents`, key: 'required' });
    if (!isMoney(line.billedCents)) issues.push({ field: `${line.id}.billedCents`, key: 'invalidMoney' });
    if (!Number.isSafeInteger(line.units) || line.units < 1) issues.push({ field: `${line.id}.units`, key: 'invalidUnits' });
  }
  return issues;
}

export function getCaseSummary(billCase: BillCase, language: Language): string {
  const f = billCase.financials;
  const balance = formatMoney(f.remainingCents, language);
  const derived = expectedRemaining(f);
  if (billCase.extraction && !(billCase.entriesEdited && billCase.source === 'manual')) {
    const extractedSummary = billCase.extraction.summary[language];
    return billCase.entriesEdited
      ? language === 'en'
        ? `Based on your confirmed entries: ${extractedSummary}`
        : `Según los datos que confirmaste: ${extractedSummary}`
      : extractedSummary;
  }
  if (billCase.reviewMode === 'connected') {
    return language === 'en'
      ? `${f.remainingCents === undefined ? 'No statement balance has been confirmed.' : `Your confirmed statement balance is ${balance}.`} Each billing code you confirmed was compared with Medicare's national rate (CMS 2026). A difference is a reason to ask, not proof of an error. Review the original documents and contact the billing office with any questions.`
      : `${f.remainingCents === undefined ? 'No se ha confirmado un saldo.' : `El saldo que confirmaste es de ${balance}.`} Cada código confirmado se comparó con la tarifa nacional de Medicare (CMS 2026). Una diferencia es un motivo para preguntar, no una prueba de un error. Revisa los documentos originales y consulta tus dudas con facturación.`;
  }
  if (billCase.source === 'manual' || billCase.reviewMode === 'manual') {
    return language === 'en'
      ? `${f.remainingCents === undefined ? 'No statement balance has been confirmed.' : `Your confirmed statement balance is ${balance}.`} ${billCase.evidenceContextId ? 'These details use the document information you confirmed. Benchmark comparisons are not connected yet.' : 'These details were entered manually. Document extraction and comparison services are not connected yet;'} Review the available original documents and contact the billing office with any questions.`
      : `El saldo que confirmaste es de ${balance}. Estos datos se ingresaron manualmente. Los servicios de extracción y comparación aún no están conectados; revisa los documentos originales y consulta tus dudas con facturación.`;
  }
  const prefix = billCase.entriesEdited
    ? language === 'en' ? 'Based on your confirmed entries: ' : 'Según los datos que confirmaste: '
    : '';
  if (derived === undefined) {
    return prefix + (language === 'en'
      ? `Your statement asks for ${balance}. Add the EOB responsibility to compare it with the amount shown on your bill.`
      : `Tu estado de cuenta solicita ${balance}. Agrega la responsabilidad indicada en la EOB para compararla con el importe de tu factura.`);
  }
  const responsibility = formatMoney(f.eobResponsibilityCents, language);
  const payment = formatMoney(f.patientPaidCents, language);
  const expected = formatMoney(derived, language);
  return prefix + (language === 'en'
    ? `Your statement asks for ${balance}. The EOB lists ${responsibility} as your responsibility. After the ${payment} payment recorded on your bill, that would leave ${expected}. Ask the billing office to reconcile the documents and confirm any repeated service lines.`
    : `Tu estado de cuenta solicita ${balance}. La explicación de beneficios (EOB) indica ${responsibility} como tu responsabilidad. Después del pago de ${payment} registrado en tu factura, quedarían ${expected}. Pide a facturación que concilie los documentos y confirme cualquier línea de servicio repetida.`);
}
