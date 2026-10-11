import type { Language, MedicalCase } from '../types';
import { formatMoney } from '../services/format';

export function FinancialSummary({ caseData, language }: { caseData: MedicalCase; language: Language }) {
  const fields = [
    ['Total billed', 'Total facturado', caseData.total_billed],
    ['Statement balance', 'Saldo de la factura', caseData.statement_balance],
    ['EOB responsibility', 'Responsabilidad según la EOB', caseData.eob_responsibility],
    ['Recorded patient payment', 'Pago registrado del paciente', caseData.patient_paid],
  ] as const;
  return <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
    {fields.map(([en, es, value]) => <div key={en} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <dt className="text-xs text-ink-secondary">{language === 'en' ? en : es}</dt>
      <dd className="mt-1 text-base font-bold tabular-nums">{formatMoney(value, language)}</dd>
    </div>)}
  </dl>;
}
