import React, { useState } from 'react';
import { MedicalCase, Language, ActiveTab } from '../types';
import { 
  Scales, 
  Copy, 
  Printer, 
  CheckCircle, 
  BuildingOffice, 
  ShieldCheck, 
  ArrowLeft,
  ArrowClockwise,
  ShareNetwork,
  DownloadSimple
} from '@phosphor-icons/react';
import confetti from 'canvas-confetti';

interface DisputeWorkspaceProps {
  caseData: MedicalCase;
  language: Language;
  onNavigateTab: (tab: ActiveTab) => void;
  onUpdateCase: (updated: MedicalCase) => void;
}

export const DisputeWorkspace: React.FC<DisputeWorkspaceProps> = ({
  caseData,
  language,
  onNavigateTab,
  onUpdateCase,
}) => {
  const [recipient, setRecipient] = useState<'billing' | 'insurer'>(
    caseData.dispute_letter_recipient || 'billing'
  );
  const [letterDraft, setLetterDraft] = useState<string>(
    language === 'en' ? caseData.dispute_letter_draft : caseData.dispute_letter_draft_es
  );
  const [isCopied, setIsCopied] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(caseData.status === 'in_dispute');

  const handleCopy = () => {
    navigator.clipboard.writeText(letterDraft);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleMarkSubmitted = () => {
    setIsSubmitted(true);
    onUpdateCase({
      ...caseData,
      status: 'in_dispute',
      notes: `Formal dispute notice sent on ${new Date().toLocaleDateString()}. Account on 30-day administrative hold.`
    });

    // Celebratory milestone confetti
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#0D9488', '#14B8A6', '#10B981', '#34D399']
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 no-print">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 border border-brand-200/80 px-2.5 py-1 rounded-full inline-block mb-1">
            {language === 'en' ? 'Step 4: Formal Dispute Package' : 'Paso 4: Carta Formal de Disputa'}
          </span>
          <h1 className="text-2xl font-extrabold text-ink-primary tracking-tight">
            {language === 'en' ? 'Prepare Your Dispute Letter' : 'Redactar su Carta de Disputa'}
          </h1>
          <p className="text-sm text-ink-secondary mt-0.5">
            {language === 'en'
              ? 'Legally grounded under the federal No Surprises Act (45 CFR § 149) and CMS coding rules.'
              : 'Fundamentada en la ley federal No Surprises Act (45 CFR § 149) y normativas CMS.'}
          </p>
        </div>

        {/* Action Buttons Bar with Varied Visual Weights */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-ink-primary shadow-subtle transition-all"
          >
            <Copy size={16} />
            <span>{isCopied ? (language === 'en' ? 'Copied!' : '¡Copiado!') : (language === 'en' ? 'Copy Text' : 'Copiar')}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-ink-primary shadow-subtle transition-all"
          >
            <Printer size={16} />
            <span>{language === 'en' ? 'Export / Print PDF' : 'Imprimir / PDF'}</span>
          </button>

          <button
            onClick={handleMarkSubmitted}
            disabled={isSubmitted}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-subtle ${
              isSubmitted
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default'
                : 'bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white shadow-card'
            }`}
          >
            <CheckCircle size={16} weight={isSubmitted ? 'fill' : 'bold'} />
            <span>
              {isSubmitted
                ? (language === 'en' ? 'Marked as Sent ✓' : 'Marcado como Enviado ✓')
                : (language === 'en' ? 'Mark Submitted & Start 30-Day Hold' : 'Marcar como Enviado')}
            </span>
          </button>
        </div>
      </div>

      {/* Recipient Segmented Selector */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-subtle no-print flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
          {language === 'en' ? 'Target Recipient:' : 'Destinatario:'}
        </span>

        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto">
          <button
            onClick={() => setRecipient('billing')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              recipient === 'billing'
                ? 'bg-white text-brand-800 shadow-sm font-bold'
                : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            <BuildingOffice size={16} />
            <span>{language === 'en' ? 'Hospital Billing Dept' : 'Facturación del Hospital'}</span>
          </button>

          <button
            onClick={() => setRecipient('insurer')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              recipient === 'insurer'
                ? 'bg-white text-brand-800 shadow-sm font-bold'
                : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            <ShieldCheck size={16} />
            <span>{language === 'en' ? 'Insurer Formal Appeal' : 'Apelación a Aseguradora'}</span>
          </button>
        </div>
      </div>

      {/* Formal Stationery Document Canvas (Print-Ready) */}
      <div className="bg-white border border-slate-300 rounded-3xl p-6 sm:p-10 shadow-card print-page max-w-4xl mx-auto space-y-4">
        {/* Printable Header */}
        <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-extrabold uppercase tracking-tight text-slate-900">
              Notice of Billing Dispute & Audit Adjustment Request
            </h2>
            <p className="text-xs text-slate-600 font-mono mt-0.5">
              Pursuant to 45 CFR § 149 (No Surprises Act) & Patient Financial Rights
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-slate-100 border border-slate-300">
            CASE #{caseData.account_number}
          </span>
        </div>

        {/* Live Editable Textarea */}
        <div className="relative">
          <textarea
            value={letterDraft}
            onChange={(e) => setLetterDraft(e.target.value)}
            rows={20}
            className="w-full font-mono text-xs sm:text-sm text-ink-primary bg-parchment-50/50 p-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all leading-relaxed"
            placeholder="Type or customize your dispute letter..."
          />
        </div>

        {/* Verification Footer Notes */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between text-xs text-ink-muted gap-2">
          <span>Patient Signature: ___________________________</span>
          <span>Date: {new Date().toLocaleDateString()}</span>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between no-print pt-2">
        <button
          onClick={() => onNavigateTab('review')}
          className="flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-ink-primary"
        >
          <ArrowLeft size={14} />
          <span>{language === 'en' ? 'Back to Review' : 'Volver a la Auditoría'}</span>
        </button>

        <button
          onClick={() => onNavigateTab('call-script')}
          className="flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800"
        >
          <span>{language === 'en' ? 'Next: Open Call Script →' : 'Siguiente: Ver Guión de Llamada →'}</span>
        </button>
      </div>
    </div>
  );
};
