import React, { useState } from 'react';
import type { MedicalCase, Language, ActiveTab } from '../types';
import { ArrowRight, FileText } from '@phosphor-icons/react';
import { FinancialSummary } from './FinancialSummary';
import { formatMoney } from '../services/format';

interface VerificationViewProps {
  caseData: MedicalCase;
  language: Language;
  onNavigateTab: (tab: ActiveTab) => void;
  onUpdateCase: (updated: MedicalCase) => void;
}

export const VerificationView: React.FC<VerificationViewProps> = ({ caseData, language, onNavigateTab }) => {
  const [filter, setFilter] = useState<'all' | 'flagged'>('all');
  const flagged = caseData.line_items.filter(item => item.status !== 'clean');
  const visible = filter === 'all' ? caseData.line_items : flagged;
  return <div className="space-y-6 animate-fade-in">
    <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-slate-200 pb-4">
      <div>
        <span className="text-xs font-bold uppercase text-brand-700">{language === 'en' ? 'Step 2: Check your documents' : 'Paso 2: Revisar sus documentos'}</span>
        <h1 className="text-2xl font-bold">{language === 'en' ? 'Check extracted details' : 'Revisar los datos extraídos'}</h1>
        <p className="text-sm text-ink-secondary mt-1">{language === 'en' ? 'Compare these details with the documents you uploaded. Missing amounts are not available.' : 'Compare estos datos con los documentos que subió. Los importes que faltan no están disponibles.'}</p>
      </div>
      <button onClick={() => onNavigateTab('review')} className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white self-start">
        {language === 'en' ? 'Review questions' : 'Revisar preguntas'} <ArrowRight size={16} />
      </button>
    </div>
    <div className="grid lg:grid-cols-12 gap-6">
      <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-card self-start">
        <h2 className="font-bold flex gap-2 items-center"><FileText size={20} />{language === 'en' ? 'Uploaded documents' : 'Documentos subidos'}</h2>
        <p className="mt-3 font-semibold">{caseData.provider_name}</p>
        {caseData.service_date && <p className="text-sm text-ink-secondary">{caseData.service_date}</p>}
        <ul className="mt-4 space-y-3 text-sm">{caseData.documents.map(doc => <li key={doc.id} className="rounded-xl border border-slate-200 p-3 break-words">
          <p className="font-semibold">{doc.name}</p><p className="text-xs text-ink-muted mt-1">{doc.size} · {doc.uploadDate}</p>
        </li>)}</ul>
      </aside>
      <div className="lg:col-span-8 space-y-5">
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-subtle">
          <h2 className="font-bold mb-3">{language === 'en' ? 'Amounts from your documents' : 'Importes de sus documentos'}</h2>
          <FinancialSummary caseData={caseData} language={language} />
        </section>
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-subtle">
          <div className="flex flex-wrap justify-between gap-3 mb-4">
            <h2 className="font-bold">{language === 'en' ? 'Extracted charges' : 'Cargos extraídos'}</h2>
            <div className="flex gap-2 text-xs">
              <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')} className="rounded-lg border border-slate-200 px-3 py-2">{language === 'en' ? 'All' : 'Todos'} ({caseData.line_items.length})</button>
              <button aria-pressed={filter === 'flagged'} onClick={() => setFilter('flagged')} className="rounded-lg border border-slate-200 px-3 py-2">{language === 'en' ? 'Questions' : 'Preguntas'} ({flagged.length})</button>
            </div>
          </div>
          {visible.length === 0 && <p className="text-sm text-ink-secondary">{language === 'en' ? 'No charges in this view.' : 'No hay cargos en esta vista.'}</p>}
          <div className="divide-y divide-slate-100">{visible.map(item => <div key={item.id} className="py-4 flex justify-between gap-4">
            <div className="min-w-0"><p className="font-semibold text-sm">{language === 'en' ? item.description : item.description_es}</p>
              {item.cpt_code && <p className="font-mono text-xs text-ink-muted mt-1">CPT {item.cpt_code}</p>}
              {item.flag_reason && <p className="text-xs text-amber-800 mt-2">{language === 'en' ? item.flag_reason : item.flag_reason_es}</p>}
            </div>
            <div className="text-right shrink-0"><p className="font-bold tabular-nums">{formatMoney(item.hospital_amount, language)}</p>
              <p className="text-xs text-ink-muted mt-1">{language === 'en' ? 'Medicare reference' : 'Referencia de Medicare'}: {formatMoney(item.benchmark_allowed, language)}</p>
            </div>
          </div>)}</div>
          <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-ink-muted">{language === 'en' ? 'Medicare references do not establish your insurer’s price or prove a billing error.' : 'Las referencias de Medicare no establecen el precio de su seguro ni prueban un error de facturación.'}</p>
        </section>
      </div>
    </div>
  </div>;
};
