import React from 'react';
import type { MedicalCase, Language, ActiveTab } from '../types';
import { FileArrowUp, ArrowRight } from '@phosphor-icons/react';
import { FinancialSummary } from './FinancialSummary';
import { formatMoney } from '../services/format';

interface DashboardProps {
  cases: MedicalCase[];
  activeCase?: MedicalCase;
  language: Language;
  onSelectCase: (id: string) => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenIntake: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ cases, activeCase, language, onSelectCase, onNavigateTab, onOpenIntake }) => <div className="space-y-6 animate-fade-in">
  <div className="border-b border-slate-200 pb-4">
    <h1 className="text-3xl font-bold tracking-tight">{language === 'en' ? 'Make sense of your medical bill.' : 'Comprenda su factura médica.'}</h1>
    <p className="text-ink-secondary mt-2 max-w-2xl">{language === 'en' ? 'Understand your charges and prepare questions for the billing office.' : 'Comprenda sus cargos y prepare preguntas para facturación.'}</p>
  </div>
  <section className="bg-gradient-to-br from-brand-50 via-white to-teal-50 border border-brand-200 rounded-3xl p-6 sm:p-8 shadow-card">
    <h2 className="text-xl font-bold">{language === 'en' ? 'Start with your documents' : 'Comience con sus documentos'}</h2>
    <p className="mt-2 text-sm text-ink-secondary">{language === 'en' ? 'Upload your bill or Explanation of Benefits to read the details and check Medicare references.' : 'Suba su factura o explicación de beneficios para leer los detalles y consultar las referencias de Medicare.'}</p>
    <button onClick={onOpenIntake} className="mt-5 flex gap-2 items-center rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white"><FileArrowUp size={18} />{language === 'en' ? 'Add documents' : 'Agregar documentos'}</button>
  </section>
  {activeCase && <>
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-5"><p className="text-sm text-ink-secondary">{language === 'en' ? 'Bills added' : 'Facturas agregadas'}</p><p className="text-2xl font-bold mt-1">{cases.length}</p></div>
      <div className="bg-white border border-slate-200 rounded-2xl p-5"><p className="text-sm text-ink-secondary">{language === 'en' ? 'Questions to review' : 'Preguntas para revisar'}</p><p className="text-2xl font-bold mt-1">{cases.reduce((sum, c) => sum + c.findings.length, 0)}</p></div>
    </div>
    <div className="grid lg:grid-cols-3 gap-6">
      <section className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-subtle space-y-4">
        <div><h2 className="text-lg font-bold">{activeCase.provider_name}</h2><p className="text-xs text-ink-secondary mt-1">{[activeCase.facility_type, activeCase.service_date, activeCase.account_number].filter(Boolean).join(' · ')}</p></div>
        <FinancialSummary caseData={activeCase} language={language} />
        {activeCase.findings.map(finding => <div key={finding.id} className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <h3 className="text-sm font-semibold">{language === 'en' ? finding.title : finding.title_es}</h3><p className="text-xs text-ink-secondary mt-1">{language === 'en' ? finding.summary : finding.summary_es}</p>
        </div>)}
        <button onClick={() => onNavigateTab('review')} className="text-sm font-semibold text-brand-700 flex gap-2 items-center">{language === 'en' ? 'Review this bill' : 'Revisar esta factura'} <ArrowRight size={16} /></button>
      </section>
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-subtle self-start">
        <h2 className="font-bold">{language === 'en' ? 'Your next step' : 'Su siguiente paso'}</h2>
        <p className="text-sm text-ink-secondary mt-3">{language === 'en' ? 'Use the phone script to ask for an itemized statement and clarification of charges.' : 'Use el guion de llamada para pedir una factura detallada y aclarar los cargos.'}</p>
        {activeCase.follow_up_date && <p className="text-sm mt-3">{language === 'en' ? 'Follow-up' : 'Seguimiento'}: {activeCase.follow_up_date}</p>}
        <button onClick={() => onNavigateTab('call-script')} className="mt-4 rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-semibold">{language === 'en' ? 'Open phone script' : 'Abrir guion de llamada'}</button>
      </section>
    </div>
    <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-subtle">
      <h2 className="font-bold mb-4">{language === 'en' ? 'Your bills' : 'Sus facturas'}</h2>
      <div className="divide-y divide-slate-100">{cases.map(c => <button key={c.id} onClick={() => { onSelectCase(c.id); onNavigateTab('review'); }} className="w-full text-left py-4 flex justify-between items-center gap-4 hover:bg-slate-50">
        <span><span className="block font-semibold">{c.provider_name}</span><span className="text-xs text-ink-secondary">{c.service_date}</span></span>
        <span className="text-right"><span className="text-xs text-ink-secondary block">{language === 'en' ? 'Statement balance' : 'Saldo de la factura'}</span><span className="font-bold tabular-nums">{formatMoney(c.statement_balance, language)}</span></span>
      </button>)}</div>
    </section>
  </>}
</div>;
