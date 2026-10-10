import React, { useState } from 'react';
import { MedicalCase, Language, ActiveTab } from '../types';
import { 
  PhoneCall, 
  CheckSquare, 
  Square, 
  Copy, 
  ArrowLeft, 
  SpeakerHigh,
  UserCheck,
  FileText,
  ClockAfternoon,
  NotePencil
} from '@phosphor-icons/react';
import { AudioPlayer } from './AudioPlayer';

interface CallScriptViewProps {
  caseData: MedicalCase;
  language: Language;
  onNavigateTab: (tab: ActiveTab) => void;
}

export const CallScriptView: React.FC<CallScriptViewProps> = ({
  caseData,
  language,
  onNavigateTab,
}) => {
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [callNotes, setCallNotes] = useState('');
  const [repName, setRepName] = useState('');
  const [ticketNum, setTicketNum] = useState('');

  const toggleCheck = (id: string) => {
    setChecklist((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const scriptText = language === 'en' ? caseData.call_script : caseData.call_script_es;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 border border-brand-200/80 px-2.5 py-1 rounded-full inline-block mb-1">
            {language === 'en' ? 'Step 5: Voice Negotiation' : 'Paso 5: Negociación Telefónica'}
          </span>
          <h1 className="text-2xl font-extrabold text-ink-primary tracking-tight">
            {language === 'en' ? 'Hospital Phone Negotiation Script' : 'Guión de Negociación Telefónica'}
          </h1>
          <p className="text-sm text-ink-secondary mt-0.5">
            {language === 'en'
              ? 'Keep the conversation calm, factual, and focused on line-item reconciliation.'
              : 'Mantenga una conversación serena y enfocada en la conciliación de cada partida.'}
          </p>
        </div>

        <button
          onClick={() => onNavigateTab('dispute')}
          className="flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800"
        >
          <ArrowLeft size={14} />
          <span>{language === 'en' ? 'Back to Dispute Letter' : 'Volver a la Carta'}</span>
        </button>
      </div>

      {/* Audio Practice Playback */}
      <AudioPlayer
        text={scriptText}
        language={language}
        title={language === 'en' ? 'Practice Spoken Script Aloud' : 'Practicar Guión en Voz Alta'}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Step-by-Step Script Dialog */}
        <div className="lg:col-span-7 space-y-4">
          {/* Step 1: Greeting & Identification */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-subtle border-l-4 border-l-brand-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                {language === 'en' ? 'Step 1: Introduction' : 'Paso 1: Saludo e Identificación'}
              </span>
              <button
                onClick={() => toggleCheck('step1')}
                className="flex items-center gap-1.5 text-xs font-semibold text-ink-secondary"
              >
                {checklist['step1'] ? (
                  <CheckSquare size={18} weight="fill" className="text-emerald-500" />
                ) : (
                  <Square size={18} className="text-slate-400" />
                )}
                <span>{language === 'en' ? 'Done' : 'Listo'}</span>
              </button>
            </div>
            <p className="text-sm text-ink-primary font-medium leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 italic">
              {language === 'en'
                ? `“Hello, my name is ${caseData.patient_name}. I am calling regarding statement #${caseData.account_number} for date of service ${caseData.service_date}. I need to clarify two specific billing discrepancies before resolving payment.”`
                : `“Hola, mi nombre es ${caseData.patient_name}. Llamo con respecto al estado de cuenta #${caseData.account_number} del ${caseData.service_date}. Necesito aclarar dos discrepancias específicas antes de proceder con el pago.”`}
            </p>
          </div>

          {/* Step 2: The Core Discrepancies */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-subtle border-l-4 border-l-rose-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
                {language === 'en' ? 'Step 2: Present the Forensic Findings' : 'Paso 2: Exponer las Discrepancias'}
              </span>
              <button
                onClick={() => toggleCheck('step2')}
                className="flex items-center gap-1.5 text-xs font-semibold text-ink-secondary"
              >
                {checklist['step2'] ? (
                  <CheckSquare size={18} weight="fill" className="text-emerald-500" />
                ) : (
                  <Square size={18} className="text-slate-400" />
                )}
                <span>{language === 'en' ? 'Done' : 'Listo'}</span>
              </button>
            </div>

            <div className="space-y-3 text-sm text-ink-primary">
              <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-200/70">
                <p className="font-semibold text-xs text-rose-900 mb-1">
                  {language === 'en' ? 'Question A (Duplicate Charge):' : 'Pregunta A (Cargo Duplicado):'}
                </p>
                <p className="italic text-xs sm:text-sm">
                  {language === 'en'
                    ? '“My bill lists code 80053 for a metabolic panel twice for $250.00 each on the same date. My insurance EOB shows only one test was performed. Could you please verify with the lab log whether this second line is an administrative duplicate?”'
                    : '“Mi factura incluye el código 80053 dos veces por $250.00 cada uno. La EOB del seguro solo registra una prueba. ¿Podrían revisar si la segunda línea fue un error administrativo?”'}
                </p>
              </div>

              <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/70">
                <p className="font-semibold text-xs text-amber-900 mb-1">
                  {language === 'en' ? 'Question B (Balance Mismatch & Copay):' : 'Pregunta B (Saldo y Copago):'}
                </p>
                <p className="italic text-xs sm:text-sm">
                  {language === 'en'
                    ? '“Second, my insurer determined my total in-network responsibility is $294.00, and I paid a $50 copay at check-in. Why does this statement ask for $494.00 rather than the reconciled $244.00?”'
                    : '“En segundo lugar, la aseguradora determinó que mi responsabilidad es $294.00, y aboné $50 de copago al ingresar. ¿Por qué el estado exige $494.00 en vez de $244.00?”'}
                </p>
              </div>
            </div>
          </div>

          {/* Step 3: Formal Hold & Resolution */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-subtle border-l-4 border-l-emerald-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                {language === 'en' ? 'Step 3: Secure an Administrative Hold' : 'Paso 3: Solicitar Pausa Administrativa'}
              </span>
              <button
                onClick={() => toggleCheck('step3')}
                className="flex items-center gap-1.5 text-xs font-semibold text-ink-secondary"
              >
                {checklist['step3'] ? (
                  <CheckSquare size={18} weight="fill" className="text-emerald-500" />
                ) : (
                  <Square size={18} className="text-slate-400" />
                )}
                <span>{language === 'en' ? 'Done' : 'Listo'}</span>
              </button>
            </div>
            <p className="text-sm text-ink-primary font-medium leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 italic">
              {language === 'en'
                ? '“While your team reviews these two entries, please place a 30-day administrative hold on account #' +
                  caseData.account_number +
                  ' so it does not trigger automated late notices. May I have your name, employee ID, and reference ticket number?”'
                : '“Mientras revisan estas dos partidas, por favor coloquen una pausa administrativa de 30 días en la cuenta #' +
                  caseData.account_number +
                  ' para evitar avisos automáticos. ¿Podría darme su nombre, ID y número de ticket?”'}
            </p>
          </div>
        </div>

        {/* Right Column (5 cols): Live Call Notes & Reference Info */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-subtle space-y-4">
            <div className="flex items-center gap-2 text-ink-primary font-bold text-sm border-b border-slate-100 pb-2">
              <NotePencil size={18} className="text-brand-600" />
              <span>{language === 'en' ? 'Live Call Tracker' : 'Registro de la Llamada'}</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-ink-secondary block mb-1">
                  {language === 'en' ? 'Representative Name & Badge ID' : 'Nombre del Representante / ID'}
                </label>
                <input
                  type="text"
                  value={repName}
                  onChange={(e) => setRepName(e.target.value)}
                  placeholder="e.g. Sarah J. (Badge #4491)"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-secondary block mb-1">
                  {language === 'en' ? 'Call Reference / Ticket Number' : 'Número de Ticket o Referencia'}
                </label>
                <input
                  type="text"
                  value={ticketNum}
                  onChange={(e) => setTicketNum(e.target.value)}
                  placeholder="e.g. TKT-99214-REV"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-secondary block mb-1">
                  {language === 'en' ? 'Call Discussion Notes' : 'Notas de la Conversación'}
                </label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  rows={6}
                  placeholder={
                    language === 'en'
                      ? 'Log what the representative said, promised correction dates, or supervisor transfers...'
                      : 'Anote lo acordado con el representante o plazos de respuesta...'
                  }
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand-500 leading-relaxed"
                />
              </div>
            </div>

            <div className="p-3 bg-brand-50 rounded-xl border border-brand-200/80 text-xs text-brand-800">
              <span className="font-bold block mb-0.5">
                {language === 'en' ? '💡 Pro Tip:' : '💡 Consejo Práctico:'}
              </span>
              {language === 'en'
                ? 'Always note the exact date and time of the call. Under the Fair Credit Billing Act, documenting this inquiry preserves your rights against debt collectors.'
                : 'Anote siempre la hora exacta. Documentar la consulta formal protege sus derechos ante agencias de cobro.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
