import React from 'react';
import { Finding, Language } from '../types';
import { 
  X, 
  ShieldCheck, 
  Copy, 
  WarningCircle, 
  Receipt, 
  ArrowRight,
  Database
} from '@phosphor-icons/react';

interface FindingModalProps {
  finding: Finding | null;
  onClose: () => void;
  language: Language;
  onPrepareDispute: () => void;
}

export const FindingModal: React.FC<FindingModalProps> = ({
  finding,
  onClose,
  language,
  onPrepareDispute,
}) => {
  if (!finding) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-slate-200/90 rounded-3xl shadow-modal w-full max-w-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800">
              {finding.cpt_code ? `CPT ${finding.cpt_code}` : 'Billing Discrepancy'}
            </span>
            <span className="text-xs font-semibold text-rose-600">{language === 'en' ? 'Supporting details' : 'Detalles de respaldo'}</span>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-ink-primary hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          <div>
            <h2 className="text-xl font-bold text-ink-primary">
              {language === 'en' ? finding.title : finding.title_es}
            </h2>
            <p className="text-xs sm:text-sm text-ink-secondary mt-1 leading-relaxed">
              {language === 'en' ? finding.explanation : finding.explanation_es}
            </p>
          </div>

          {/* Supporting details */}
          <div className="bg-parchment-100 border border-slate-300 rounded-2xl p-4 font-mono text-xs text-ink-primary space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block">
              ORIGINAL EXTRACTED EVIDENCE
            </span>
            <p className="bg-white p-3 rounded-xl border border-slate-200 text-slate-800 leading-relaxed">
              {finding.evidence_quote}
            </p>
            <span className="text-[10px] text-ink-muted block">
              Comparison Basis: {language === 'en' ? finding.comparison_basis : finding.comparison_basis_es}
            </span>
          </div>

          {/* Statutory Protection Citation */}
          {finding.statutory_rule && (
            <div className="p-3.5 rounded-2xl bg-brand-50/70 border border-brand-200/80 text-xs text-brand-900 flex items-start gap-2.5">
              <ShieldCheck size={20} weight="fill" className="text-brand-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Statutory Protection:</span>
                <p>{language === 'en' ? finding.statutory_rule : finding.statutory_rule_es}</p>
              </div>
            </div>
          )}

          {/* Suggested Question */}
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-xs text-ink-primary space-y-1.5">
            <span className="font-bold uppercase tracking-wider text-amber-900 block">
              {language === 'en' ? 'Exact Question to Challenge this Charge:' : 'Pregunta Exacta para Desafiar el Cargo:'}
            </span>
            <p className="italic font-medium leading-relaxed">
              {language === 'en' ? finding.question_for_billing : finding.question_for_billing_es}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-ink-secondary hover:text-ink-primary"
          >
            {language === 'en' ? 'Close' : 'Cerrar'}
          </button>

          <button
            onClick={() => {
              onClose();
              onPrepareDispute();
            }}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-subtle transition-all"
          >
            <span>{language === 'en' ? 'Add to billing request' : 'Agregar a la solicitud'}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
