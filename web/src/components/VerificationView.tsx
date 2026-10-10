import React, { useState } from 'react';
import { MedicalCase, Language, ActiveTab, LineItem } from '../types';
import { 
  CheckCircle, 
  ArrowRight, 
  WarningCircle, 
  FilePdf, 
  MagnifyingGlassPlus, 
  PencilSimple,
  Receipt,
  Scales
} from '@phosphor-icons/react';

interface VerificationViewProps {
  caseData: MedicalCase;
  language: Language;
  onNavigateTab: (tab: ActiveTab) => void;
  onUpdateCase: (updated: MedicalCase) => void;
}

export const VerificationView: React.FC<VerificationViewProps> = ({
  caseData,
  language,
  onNavigateTab,
  onUpdateCase,
}) => {
  const [activeTabSub, setActiveTabSub] = useState<'all' | 'flagged'>('all');
  const [selectedItem, setSelectedItem] = useState<LineItem | null>(null);

  const handleUpdateItem = (id: string, newAmount: number) => {
    const updatedLineItems = caseData.line_items.map((item) =>
      item.id === id ? { ...item, hospital_amount: newAmount } : item
    );
    onUpdateCase({
      ...caseData,
      line_items: updatedLineItems,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 border border-brand-200/80 px-2.5 py-1 rounded-full inline-block mb-1">
            {language === 'en' ? 'Step 2: Source Verification' : 'Paso 2: Verificación de Fuente'}
          </span>
          <h1 className="text-2xl font-extrabold text-ink-primary tracking-tight">
            {language === 'en' ? 'Verify Extracted Details' : 'Verificar Detalles Extraídos'}
          </h1>
          <p className="text-sm text-ink-secondary mt-0.5">
            {language === 'en'
              ? 'Compare each extracted value against the hospital statement and insurer EOB. Tap any field to edit.'
              : 'Compare cada valor extraído con el estado de cuenta y la EOB. Puede modificar cualquier campo.'}
          </p>
        </div>

        <button
          onClick={() => onNavigateTab('review')}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-subtle hover:shadow-card transition-all"
        >
          <span>{language === 'en' ? 'Proceed to Audit Findings' : 'Ir a Hallazgos de Auditoría'}</span>
          <ArrowRight size={16} weight="bold" />
        </button>
      </div>

      {/* Two-Column Forensic Inspection Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): High-Fidelity Synthetic Document Specimen */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-card sticky top-20">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-ink-primary font-bold text-sm">
                <FilePdf size={20} className="text-rose-500" />
                <span>{caseData.provider_name} Statement</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                PDF SPECIMEN
              </span>
            </div>

            {/* Document Paper Simulation */}
            <div className="bg-parchment-100 border border-slate-300/80 rounded-xl p-5 font-mono text-xs text-ink-primary shadow-inner space-y-4 leading-relaxed">
              {/* Statement Header */}
              <div className="border-b border-slate-300 pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-sm tracking-tight text-ink-primary">
                      {caseData.provider_name}
                    </p>
                    <p className="text-[10px] text-ink-muted">PO Box 4492 · Department of Patient Accounts</p>
                  </div>
                  <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-300">
                    SYNTHETIC DEMO
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 text-[11px] text-ink-secondary gap-y-1">
                  <div>Statement Date: <span className="font-semibold text-ink-primary">{caseData.statement_date}</span></div>
                  <div>Service Date: <span className="font-semibold text-ink-primary">{caseData.service_date}</span></div>
                  <div>Account #: <span className="font-semibold text-ink-primary">{caseData.account_number}</span></div>
                  <div>Patient: <span className="font-semibold text-ink-primary">{caseData.patient_name}</span></div>
                </div>
              </div>

              {/* Itemized Table Simulation */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-secondary mb-1">
                  Itemized Charges
                </p>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span>99284 ER Visit Level 4</span>
                    <span className="tabular-nums font-semibold">$1,670.00</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span>70450 CT Scan Head/Brain</span>
                    <span className="tabular-nums font-semibold">$500.00</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-rose-300 bg-rose-50/80 px-1 rounded -mx-1 text-rose-900 font-bold">
                    <span>80053 Metabolic Panel [1]</span>
                    <span className="tabular-nums">$250.00</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-rose-300 bg-rose-50/80 px-1 rounded -mx-1 text-rose-900 font-bold">
                    <span>80053 Metabolic Panel [2 - DUPL]</span>
                    <span className="tabular-nums">$250.00</span>
                  </div>
                </div>
              </div>

              {/* Financial Totals Reconciliation Box */}
              <div className="pt-2 border-t-2 border-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Total Billed Charges:</span>
                  <span className="tabular-nums font-semibold">${caseData.total_billed.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>In-Network Adjustment:</span>
                  <span className="tabular-nums font-semibold">-${caseData.insurer_adjustments.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Insurer Paid:</span>
                  <span className="tabular-nums font-semibold">-${caseData.insurer_paid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Prior Patient Copay:</span>
                  <span className="tabular-nums font-semibold">-${caseData.patient_paid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-300 text-sm font-bold text-ink-primary">
                  <span>Statement Demands:</span>
                  <span className="tabular-nums text-rose-600">${caseData.statement_balance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-brand-800 font-semibold bg-brand-50 p-1.5 rounded">
                  <span>EOB Member Responsibility:</span>
                  <span className="tabular-nums">${caseData.eob_responsibility.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-ink-muted">
              <span>Source: Gemini Multimodal Vision Parser</span>
              <span className="text-brand-600 font-semibold cursor-pointer hover:underline flex items-center gap-1">
                <MagnifyingGlassPlus size={14} /> Full Specimen
              </span>
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Extracted Fields & Reconciliation Ledger */}
        <div className="lg:col-span-7 space-y-6">
          {/* Summary Reconciliation Banner */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-subtle border-l-4 border-l-brand-600">
            <h3 className="text-sm font-bold text-ink-primary mb-3 flex items-center gap-2">
              <Scales size={18} className="text-brand-600" />
              <span>{language === 'en' ? 'Reconciliation Ledger' : 'Conciliación Financiera'}</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                <span className="text-ink-muted block">{language === 'en' ? 'Billed' : 'Facturado'}</span>
                <span className="text-base font-bold text-ink-primary tabular-nums mt-0.5 block">
                  ${caseData.total_billed.toFixed(2)}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                <span className="text-ink-muted block">{language === 'en' ? 'Insurer Paid' : 'Pagó Aseguradora'}</span>
                <span className="text-base font-bold text-emerald-600 tabular-nums mt-0.5 block">
                  ${caseData.insurer_paid.toFixed(2)}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                <span className="text-ink-muted block">{language === 'en' ? 'Prior Copay' : 'Copago Previo'}</span>
                <span className="text-base font-bold text-ink-primary tabular-nums mt-0.5 block">
                  ${caseData.patient_paid.toFixed(2)}
                </span>
              </div>

              <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
                <span className="text-rose-700 font-semibold block">{language === 'en' ? 'Overcharge' : 'Sobrecargo'}</span>
                <span className="text-base font-bold text-rose-600 tabular-nums mt-0.5 block">
                  ${caseData.discrepancy_amount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Line Items Table with Varied Visual States */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-subtle">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-sm font-bold text-ink-primary">
                  {language === 'en' ? 'Extracted CPT Line Items' : 'Códigos CPT Extraídos'}
                </h3>
                <p className="text-xs text-ink-muted">
                  {language === 'en' ? 'Cross-referenced against CMS NCCI edit tables' : 'Cotejados con tablas CMS NCCI'}
                </p>
              </div>

              {/* Sub-filter pills */}
              <div className="flex gap-1 text-xs bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
                <button
                  onClick={() => setActiveTabSub('all')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    activeTabSub === 'all' ? 'bg-white text-ink-primary shadow-sm font-semibold' : 'text-ink-muted'
                  }`}
                >
                  {language === 'en' ? 'All (4)' : 'Todos (4)'}
                </button>
                <button
                  onClick={() => setActiveTabSub('flagged')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    activeTabSub === 'flagged' ? 'bg-white text-rose-700 shadow-sm font-semibold' : 'text-ink-muted'
                  }`}
                >
                  {language === 'en' ? 'Flagged (2)' : 'Señalados (2)'}
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {caseData.line_items
                .filter((item) => (activeTabSub === 'flagged' ? item.status !== 'clean' : true))
                .map((item) => (
                  <div
                    key={item.id}
                    className={`py-3.5 px-3 rounded-xl transition-all ${
                      item.status !== 'clean'
                        ? 'bg-rose-50/50 border border-rose-200/70 my-1.5'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                            CPT {item.cpt_code}
                          </span>
                          <h4 className="text-xs sm:text-sm font-bold text-ink-primary">
                            {language === 'en' ? item.description : item.description_es}
                          </h4>
                        </div>

                        {item.flag_reason && (
                          <div className="flex items-center gap-1.5 text-xs text-rose-700 font-medium pt-1">
                            <WarningCircle size={15} weight="fill" className="text-rose-500 shrink-0" />
                            <span>{language === 'en' ? item.flag_reason : item.flag_reason_es}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-ink-primary tabular-nums">
                          ${item.hospital_amount.toFixed(2)}
                        </div>
                        <span className="text-[10px] text-ink-muted block">
                          Benchmark: ${item.benchmark_allowed.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Bottom Actions */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-ink-muted">
                {language === 'en' ? 'All 4 codes match clinical record' : 'Los 4 códigos coinciden con la historia'}
              </span>

              <button
                onClick={() => onNavigateTab('review')}
                className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-subtle transition-all"
              >
                <span>{language === 'en' ? 'Confirm and View Review' : 'Confirmar y Ver Auditoría'}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
