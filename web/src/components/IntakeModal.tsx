import { useEffect, useRef, useState } from 'react';
import type { Language, MedicalCase } from '../types';
import { X, FileArrowUp, CircleNotch } from '@phosphor-icons/react';
import { analyzeDocuments, backend, BackendError } from '../services';

interface IntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onCaseParsed: (caseData: MedicalCase) => void;
}

export function IntakeModal({ isOpen, onClose, language, onCaseParsed }: IntakeModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  useEffect(() => { if (!isOpen) { generation.current++; setBusy(false); } }, [isOpen]);
  const copy = (en: string, es: string) => language === 'en' ? en : es;
  function choose(next: File[]) {
    setError('');
    if (next.length > 10 || next.some(file => !/^image\//.test(file.type) && file.type !== 'application/pdf')) {
      setError(copy('Choose up to 10 photos or PDF documents.', 'Elige hasta 10 fotos o documentos PDF.'));
      return;
    }
    setFiles(next);
  }
  async function analyze() {
    if (busy || !files.length || !backend.configured) return;
    const token = ++generation.current;
    setBusy(true); setError('');
    try {
      const billCase = await analyzeDocuments(files, language);
      if (generation.current !== token) return;
      onCaseParsed(billCase); setFiles([]); onClose();
    } catch (failure) {
      if (generation.current !== token) return;
      setError(failure instanceof BackendError && failure.message === 'unreachable'
        ? copy('Could not reach Footnote. Your documents are still selected; try again.', 'No se pudo conectar con Footnote. Tus documentos siguen seleccionados; intenta de nuevo.')
        : copy('Your document could not be read. Check the file and try again.', 'No se pudo leer el documento. Revisa el archivo e intenta de nuevo.'));
    } finally { if (generation.current === token) setBusy(false); }
  }
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
    <div role="dialog" aria-modal="true" aria-labelledby="intake-title" className="bg-white rounded-3xl shadow-modal w-full max-w-xl p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 id="intake-title" className="text-xl font-bold">{copy('Start with your documents', 'Empieza con tus documentos')}</h2><button aria-label={copy('Close', 'Cerrar')} onClick={onClose} className="p-2"><X size={20} /></button></div>
      <p className="text-ink-secondary">{copy('Add your medical bill, explanation of benefits, or both. Check the extracted details before continuing.', 'Agrega tu factura médica, explicación de beneficios o ambas. Verifica los datos extraídos antes de continuar.')}</p>
      <input ref={picker} type="file" accept="application/pdf,image/*" multiple hidden onChange={event => choose(Array.from(event.target.files ?? []))} />
      <button disabled={busy} onClick={() => picker.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!busy) choose(Array.from(event.dataTransfer.files)); }} className="w-full rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/40 p-8 text-center disabled:opacity-50">
        <FileArrowUp size={32} className="mx-auto mb-3 text-brand-600" />{copy('Choose photos or PDFs, or drop them here', 'Elige fotos o PDF, o arrástralos aquí')}
      </button>
      {!!files.length && <ul className="space-y-1 text-sm">{files.map((file, index) => <li key={index}>{file.name}</li>)}</ul>}
      {!backend.configured && <p role="status">{copy('Document reading is unavailable. Open the Footnote mobile app to enter the details manually.', 'La lectura de documentos no está disponible. Abre la app móvil de Footnote para ingresar los datos manualmente.')}</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <p className="text-xs text-ink-muted">{copy('When you continue, these documents are sent to Footnote for analysis with Gemini and saved with Tiger Data.', 'Al continuar, estos documentos se envían a Footnote para analizarlos con Gemini y guardarlos con Tiger Data.')}</p>
      <div className="flex justify-end gap-3"><button onClick={onClose} className="px-4 py-2">{copy('Cancel', 'Cancelar')}</button><button disabled={busy || !files.length || !backend.configured} onClick={() => void analyze()} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-white disabled:opacity-50">{busy && <CircleNotch size={18} className="animate-spin" />}{busy ? copy('Reading your documents…', 'Leyendo tus documentos…') : copy('Use these documents', 'Usar estos documentos')}</button></div>
    </div>
  </div>;
}
