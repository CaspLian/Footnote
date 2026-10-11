import React, { useState } from 'react';
import type { MedicalCase, Language, ActiveTab } from '../types';
import { ArrowLeft, Copy } from '@phosphor-icons/react';
import { AudioPlayer } from './AudioPlayer';

interface CallScriptViewProps {
  caseData: MedicalCase;
  language: Language;
  onNavigateTab: (tab: ActiveTab) => void;
}

export const CallScriptView: React.FC<CallScriptViewProps> = ({ caseData, language, onNavigateTab }) => {
  const [callNotes, setCallNotes] = useState('');
  const [repName, setRepName] = useState('');
  const [ticketNum, setTicketNum] = useState('');
  const [copied, setCopied] = useState(false);
  const scriptText = language === 'en' ? caseData.call_script : caseData.call_script_es;
  const copyScript = async () => { await navigator.clipboard.writeText(scriptText); setCopied(true); };
  return <div className="space-y-6 animate-fade-in">
    <div className="flex flex-wrap justify-between gap-4 border-b border-slate-200 pb-4">
      <div><span className="text-xs font-bold uppercase text-brand-700">{language === 'en' ? 'Step 5: Prepare your call' : 'Paso 5: Preparar su llamada'}</span>
        <h1 className="text-2xl font-bold">{language === 'en' ? 'Billing phone script' : 'Guion para llamar a facturación'}</h1>
        <p className="text-sm text-ink-secondary mt-1">{caseData.provider_name}</p>
      </div>
      <button onClick={() => onNavigateTab('dispute')} className="self-start flex gap-2 items-center text-sm font-semibold text-brand-700"><ArrowLeft size={16} />{language === 'en' ? 'Back to your request' : 'Volver a su solicitud'}</button>
    </div>
    <AudioPlayer text={scriptText} language={language} title={language === 'en' ? 'Practice your phone script' : 'Practicar su guion de llamada'} />
    <div className="grid lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 space-y-4">
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-subtle">
          <div className="flex justify-between gap-3 mb-4"><h2 className="font-bold">{language === 'en' ? 'Your questions' : 'Sus preguntas'}</h2>
            <button onClick={copyScript} className="text-sm text-brand-700 flex items-center gap-2"><Copy size={16} />{copied ? (language === 'en' ? 'Copied' : 'Copiado') : (language === 'en' ? 'Copy' : 'Copiar')}</button>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed bg-slate-50 rounded-xl border border-slate-200 p-4">{scriptText}</p>
        </section>
        <section className="bg-brand-50 border border-brand-200 rounded-2xl p-5">
          <h2 className="font-bold text-sm">{language === 'en' ? 'Before you finish' : 'Antes de terminar'}</h2>
          <p className="text-sm mt-2">{language === 'en' ? 'Ask when you can expect a reply, whether the account can be paused during review, and how to get written confirmation. Record the representative’s name and reference number.' : 'Pregunte cuándo recibirá una respuesta, si pueden pausar la cuenta durante la revisión y cómo obtener confirmación escrita. Anote el nombre del representante y el número de referencia.'}</p>
        </section>
      </div>
      <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-subtle space-y-4 self-start">
        <h2 className="font-bold">{language === 'en' ? 'Call notes' : 'Notas de la llamada'}</h2>
        <label className="block text-sm">{language === 'en' ? 'Representative name' : 'Nombre del representante'}<input value={repName} onChange={e => setRepName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
        <label className="block text-sm">{language === 'en' ? 'Reference number' : 'Número de referencia'}<input value={ticketNum} onChange={e => setTicketNum(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
        <label className="block text-sm">{language === 'en' ? 'Discussion and next steps' : 'Conversación y siguientes pasos'}<textarea value={callNotes} onChange={e => setCallNotes(e.target.value)} rows={6} className="mt-1 w-full rounded-xl border border-slate-200 p-3" /></label>
        <p className="text-xs text-ink-muted">{language === 'en' ? 'Notes stay on this screen until you leave it. Keep your own copy.' : 'Las notas permanecen en esta pantalla hasta que la cierre. Guarde su propia copia.'}</p>
      </section>
    </div>
  </div>;
};
