import React from 'react';
import type { MedicalCase, Language, ActiveTab, Finding } from '../types';
import { ArrowRight } from '@phosphor-icons/react';
import { AudioPlayer } from './AudioPlayer';
import { FinancialSummary } from './FinancialSummary';

interface ReviewViewProps {
  caseData: MedicalCase;
  language: Language;
  onNavigateTab: (tab: ActiveTab) => void;
  onSelectFinding: (finding: Finding) => void;
}

export const ReviewView: React.FC<ReviewViewProps> = ({ caseData, language, onNavigateTab, onSelectFinding }) => <div className="space-y-6 animate-fade-in">
  <div className="border-b border-slate-200 pb-4">
    <span className="text-xs font-bold uppercase text-brand-700">{language === 'en' ? 'Step 3: Understand your bill' : 'Paso 3: Comprender su factura'}</span>
    <h1 className="text-2xl font-bold mt-1">{language === 'en' ? 'Bill review' : 'Revisión de la factura'}</h1>
    <p className="text-sm text-ink-secondary mt-1">{[caseData.provider_name, caseData.account_number, caseData.service_date].filter(Boolean).join(' · ')}</p>
  </div>
  <section className="bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-card">
    <h2 className="text-lg font-bold">{language === 'en' ? 'What your documents say' : 'Qué dicen sus documentos'}</h2>
    <p className="text-sm text-slate-200 leading-relaxed mt-3">{caseData.plain_summary || (language === 'en' ? caseData.audio_summary_script : caseData.audio_summary_script_es)}</p>
    <p className="text-xs text-slate-300 mt-4">{language === 'en' ? 'These details can help you ask questions. They do not establish an error, a corrected balance, or savings.' : 'Estos datos pueden ayudarle a hacer preguntas. No establecen un error, un saldo corregido ni un ahorro.'}</p>
  </section>
  <FinancialSummary caseData={caseData} language={language} />
  <AudioPlayer text={language === 'en' ? caseData.audio_summary_script : caseData.audio_summary_script_es} language={language} title={language === 'en' ? 'Listen to your bill summary' : 'Escuchar el resumen de su factura'} />
  <section className="space-y-4">
    <h2 className="text-lg font-bold">{language === 'en' ? 'Questions for billing' : 'Preguntas para facturación'} ({caseData.findings.length})</h2>
    {caseData.findings.length === 0 && <p className="text-sm text-ink-secondary">{language === 'en' ? 'No price questions were identified. This does not confirm that every charge is correct.' : 'No se identificaron preguntas de precios. Esto no confirma que todos los cargos sean correctos.'}</p>}
    {caseData.findings.map((finding, index) => <article key={finding.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-subtle space-y-3">
      <p className="text-xs font-semibold text-brand-700">{language === 'en' ? 'Question' : 'Pregunta'} {index + 1}{finding.cpt_code ? ` · CPT ${finding.cpt_code}` : ''}</p>
      <h3 className="text-base font-bold">{language === 'en' ? finding.title : finding.title_es}</h3>
      <p className="text-sm text-ink-secondary">{language === 'en' ? finding.explanation : finding.explanation_es}</p>
      <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm">{language === 'en' ? finding.question_for_billing : finding.question_for_billing_es}</p>
      <button onClick={() => onSelectFinding(finding)} className="text-sm font-semibold text-brand-700">{language === 'en' ? 'View supporting details' : 'Ver los detalles de respaldo'} →</button>
    </article>)}
  </section>
  <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-wrap gap-3">
    <button onClick={() => onNavigateTab('call-script')} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold">{language === 'en' ? 'Phone script' : 'Guion de llamada'}</button>
    <button onClick={() => onNavigateTab('dispute')} className="rounded-xl bg-brand-600 text-white px-4 py-3 text-sm font-semibold flex items-center gap-2">{language === 'en' ? 'Prepare a billing request' : 'Preparar una solicitud de facturación'} <ArrowRight size={16} /></button>
  </div>
</div>;
