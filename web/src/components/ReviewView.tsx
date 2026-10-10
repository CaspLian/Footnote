import React, { useState } from 'react';
import { MedicalCase, Language, ActiveTab, Finding } from '../types';
import { 
  FileText, 
  ArrowRight, 
  WarningCircle, 
  CheckCircle, 
  Scales, 
  Copy, 
  SpeakerHigh,
  Info,
  Question,
  ShieldCheck,
  ShareNetwork,
  Sparkle
} from '@phosphor-icons/react';
import { AudioPlayer } from './AudioPlayer';

interface ReviewViewProps {
  caseData: MedicalCase;
  language: Language;
  onNavigateTab: (tab: ActiveTab) => void;
  onSelectFinding: (finding: Finding) => void;
}

export const ReviewView: React.FC<ReviewViewProps> = ({
  caseData,
  language,
  onNavigateTab,
  onSelectFinding,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyQuestion = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 border border-brand-200/80 px-2.5 py-1 rounded-full inline-block mb-1">
            {language === 'en' ? 'Step 3: Forensic Findings' : 'Paso 3: Hallazgos Forenses'}
          </span>
          <h1 className="text-2xl font-extrabold text-ink-primary tracking-tight">
            {language === 'en' ? 'Bill Review & Discrepancies' : 'Auditoría y Discrepancias de Cuenta'}
          </h1>
          <p className="text-sm text-ink-secondary mt-0.5">
            {caseData.provider_name} · Statement #{caseData.account_number} · {caseData.service_date}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateTab('dispute')}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-subtle hover:shadow-card transition-all"
          >
            <span>{language === 'en' ? 'Prepare Dispute Letter' : 'Preparar Carta de Disputa'}</span>
            <ArrowRight size={16} weight="bold" />
          </button>
        </div>
      </div>

      {/* Discrepancy Hero Stat Card (The Magic Moment) */}
      <div className="bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-card border border-brand-800/60 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-brand-500/20 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
              {language === 'en' ? 'Unreconciled Difference' : 'Diferencia No Reconciliada'}
            </span>
            <span className="text-xs text-slate-300 font-mono">
              {language === 'en' ? 'CMS NCCI Benchmark' : 'Baremos CMS NCCI'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4 mt-2">
            <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-emerald-400 tabular-nums">
              ${caseData.discrepancy_amount.toFixed(2)}
            </span>
            <span className="text-sm sm:text-base text-slate-300 font-medium">
              {language === 'en' ? 'requires formal billing explanation' : 'requiere aclaración formal del hospital'}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 mt-3 leading-relaxed">
            {language === 'en'
              ? 'Your hospital statement demands $494.00, but your insurer EOB establishes a member responsibility of only $294.00. Factoring in your $50 emergency copay, your true owed balance should not exceed $244.00.'
              : 'El hospital exige $494.00, pero su seguro establece una responsabilidad de $294.00. Restando el copago de $50 pagado al ingreso, su saldo real no debe superar los $244.00.'}
          </p>

          {/* Forensic Arithmetic Equation */}
          <div className="mt-6 pt-5 border-t border-slate-700/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">STATEMENT DEMAND</span>
              <span className="text-base font-bold text-white tabular-nums">${caseData.statement_balance.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">EOB RESPONSIBILITY</span>
              <span className="text-base font-bold text-white tabular-nums">${caseData.eob_responsibility.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">RECORDED COPAY</span>
              <span className="text-base font-bold text-emerald-400 tabular-nums">-${caseData.patient_paid.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-emerald-300 font-bold block text-[10px]">RECONCILED DUE</span>
              <span className="text-base font-bold text-emerald-400 tabular-nums">${caseData.derived_remaining.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Voice Advocate Narration Player Bar (ElevenLabs Integration) */}
      <AudioPlayer
        text={language === 'en' ? caseData.audio_summary_script : caseData.audio_summary_script_es}
        language={language}
        title={language === 'en' ? 'Listen to Plain-Language Forensic Summary' : 'Escuchar Resumen Forense'}
      />

      {/* Prioritized Findings List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-ink-primary">
            {language === 'en' ? 'Two Key Questions for Hospital Billing' : 'Dos Preguntas Clave para Facturación'}
          </h2>
          <span className="text-xs text-ink-muted">
            {language === 'en' ? 'Ranked by recoverable savings' : 'Ordenado por potencial de ahorro'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {caseData.findings.map((finding, idx) => (
            <div
              key={finding.id}
              className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-subtle hover:shadow-card transition-all border-l-4 border-l-rose-500"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800">
                      {language === 'en' ? `Finding #${idx + 1}` : `Hallazgo #${idx + 1}`}
                    </span>
                    {finding.cpt_code && (
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        CPT {finding.cpt_code}
                      </span>
                    )}
                    <span className="text-xs font-bold text-rose-600">
                      {language === 'en' ? 'High Severity' : 'Alta Severidad'}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-ink-primary">
                    {language === 'en' ? finding.title : finding.title_es}
                  </h3>

                  <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
                    {language === 'en' ? finding.explanation : finding.explanation_es}
                  </p>

                  {/* Evidence Source Box */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs font-mono text-ink-secondary">
                    <span className="text-[10px] font-bold uppercase text-ink-muted block mb-1">
                      EVIDENCE BASIS
                    </span>
                    {finding.evidence_quote}
                  </div>

                  {/* Statutory Rule */}
                  {finding.statutory_rule && (
                    <div className="flex items-center gap-1.5 text-xs text-brand-700 font-medium">
                      <ShieldCheck size={16} weight="fill" className="text-brand-600 shrink-0" />
                      <span>{language === 'en' ? finding.statutory_rule : finding.statutory_rule_es}</span>
                    </div>
                  )}

                  {/* Question to Ask Billing */}
                  <div className="pt-2">
                    <span className="text-xs font-bold text-ink-primary uppercase tracking-wider block mb-1">
                      {language === 'en' ? 'Recommended Question to Ask:' : 'Pregunta Recomendada:'}
                    </span>
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-ink-primary flex items-center justify-between gap-3">
                      <span className="italic font-medium">
                        {language === 'en' ? finding.question_for_billing : finding.question_for_billing_es}
                      </span>
                      <button
                        onClick={() =>
                          handleCopyQuestion(
                            finding.id,
                            language === 'en' ? finding.question_for_billing : finding.question_for_billing_es
                          )
                        }
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 text-[11px] font-semibold transition-all shadow-subtle"
                        title="Copy question"
                      >
                        <Copy size={13} />
                        <span>{copiedId === finding.id ? (language === 'en' ? 'Copied!' : 'Copiado!') : (language === 'en' ? 'Copy' : 'Copiar')}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0 sm:border-l sm:border-slate-100 sm:pl-6 space-y-3">
                  <div>
                    <span className="text-xs text-ink-muted block">
                      {language === 'en' ? 'Discrepancy' : 'Discrepancia'}
                    </span>
                    <span className="text-xl font-bold text-rose-600 tabular-nums">
                      +${finding.potential_savings.toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={() => onSelectFinding(finding)}
                    className="w-full text-xs font-semibold text-brand-700 hover:text-brand-800 hover:underline block pt-1"
                  >
                    {language === 'en' ? 'View Evidence Specimen →' : 'Ver Muestra de Evidencia →'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Conversion Action Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-ink-primary">
            {language === 'en' ? 'Ready to challenge this bill?' : '¿Listo para disputar esta cuenta?'}
          </h4>
          <p className="text-xs text-ink-muted">
            {language === 'en'
              ? 'Generate a formal dispute package citing the No Surprises Act or open the interactive call script.'
              : 'Genere una carta de disputa formal o utilice el guión interactivo de llamada.'}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => onNavigateTab('call-script')}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-ink-primary transition-colors"
          >
            {language === 'en' ? 'Phone Script' : 'Guión de Llamada'}
          </button>
          <button
            onClick={() => onNavigateTab('dispute')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-subtle transition-colors"
          >
            <span>{language === 'en' ? 'Draft Dispute Letter' : 'Redactar Carta de Disputa'}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
