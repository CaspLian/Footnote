import React, { useState } from 'react';
import { Language, MedicalCase } from '../types';
import { 
  X, 
  Camera, 
  Images, 
  FilePdf, 
  UploadSimple, 
  CheckCircle, 
  CircleNotch,
  Sparkle,
  ShieldCheck,
  ArrowRight
} from '@phosphor-icons/react';

interface IntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onCaseParsed: (caseData: MedicalCase) => void;
  sampleCases: MedicalCase[];
}

export const IntakeModal: React.FC<IntakeModalProps> = ({
  isOpen,
  onClose,
  language,
  onCaseParsed,
  sampleCases,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<'bill' | 'eob'>('bill');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);

  if (!isOpen) return null;

  const handleSimulateUpload = (caseToLoad: MedicalCase) => {
    setIsProcessing(true);
    setProcessingStep(1);

    setTimeout(() => {
      setProcessingStep(2);
      setTimeout(() => {
        setProcessingStep(3);
        setTimeout(() => {
          setIsProcessing(false);
          setProcessingStep(0);
          onCaseParsed(caseToLoad);
          onClose();
        }, 800);
      }, 900);
    }, 900);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-slate-200/90 rounded-3xl shadow-modal w-full max-w-2xl overflow-hidden animate-scale-up">
        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded">
                Gemini 1.5 Multimodal OCR
              </span>
            </div>
            <h2 className="text-xl font-bold text-ink-primary mt-1">
              {language === 'en' ? 'Add Documents to Audit' : 'Agregar Documentos para Auditar'}
            </h2>
            <p className="text-xs text-ink-muted">
              {language === 'en'
                ? 'Upload itemized hospital bills, EOB explanations, or health insurance policies.'
                : 'Suba facturas de hospital, explicaciones EOB o pólizas de seguro.'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-ink-primary hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {isProcessing ? (
            /* OCR Progress Steps Animation */
            <div className="py-12 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <CircleNotch size={56} className="text-brand-600 animate-spin" />
                <Sparkle size={24} className="text-brand-600 absolute" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-ink-primary">
                  {language === 'en' ? 'Analyzing Medical Document...' : 'Analizando Documento Médico...'}
                </h3>
                <p className="text-xs text-ink-secondary">
                  {processingStep === 1 &&
                    (language === 'en'
                      ? 'Extracting CPT codes, facility fees, and billing dates...'
                      : 'Extrayendo códigos CPT, cargos de instalación y fechas...')}
                  {processingStep === 2 &&
                    (language === 'en'
                      ? 'Cross-referencing regional Medicare allowable price benchmarks...'
                      : 'Cotejando baremos de precios de Medicare regional...')}
                  {processingStep === 3 &&
                    (language === 'en'
                      ? 'Matching patient responsibility against EOB adjudications...'
                      : 'Conciliando responsabilidad del paciente con la EOB...')}
                </p>
              </div>

              {/* Step dots */}
              <div className="flex justify-center gap-2 pt-2">
                {[1, 2, 3].map((step) => (
                  <span
                    key={step}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      processingStep >= step ? 'bg-brand-600 scale-110' : 'bg-slate-200'
                    }`}
                  ></span>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Document Type Selector Pill */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                <span className="text-xs font-semibold text-ink-secondary">
                  {language === 'en' ? 'Document Classification:' : 'Tipo de Documento:'}
                </span>

                <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setDocType('bill')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      docType === 'bill'
                        ? 'bg-brand-600 text-white shadow-subtle'
                        : 'text-ink-secondary hover:text-ink-primary'
                    }`}
                  >
                    {language === 'en' ? 'Hospital Bill / Statement' : 'Factura de Hospital'}
                  </button>
                  <button
                    onClick={() => setDocType('eob')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      docType === 'eob'
                        ? 'bg-brand-600 text-white shadow-subtle'
                        : 'text-ink-secondary hover:text-ink-primary'
                    }`}
                  >
                    {language === 'en' ? 'Insurance EOB' : 'EOB de Aseguradora'}
                  </button>
                </div>
              </div>

              {/* Asymmetric Dropzone Area (Fixing the 3 same-size buttons!) */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-brand-300 hover:border-brand-500 rounded-3xl p-8 text-center bg-brand-50/30 hover:bg-brand-50/60 transition-all cursor-pointer group"
                onClick={() => handleSimulateUpload(sampleCases[0])}
              >
                <div className="w-14 h-14 rounded-2xl bg-white text-brand-600 flex items-center justify-center mx-auto shadow-subtle group-hover:scale-105 transition-transform mb-3 border border-brand-200">
                  <UploadSimple size={28} weight="bold" />
                </div>
                <h4 className="text-sm font-bold text-ink-primary">
                  {language === 'en'
                    ? 'Click to browse or drag and drop your document'
                    : 'Haga clic para examinar o arrastre su documento'}
                </h4>
                <p className="text-xs text-ink-muted mt-1">
                  Supports PDF statements, camera photos (PNG, JPG), or scanned invoices
                </p>

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-white border border-slate-200 text-ink-secondary">
                    <Camera size={14} /> Camera Capture
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-white border border-slate-200 text-ink-secondary">
                    <Images size={14} /> Photo Library
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-white border border-slate-200 text-ink-secondary">
                    <FilePdf size={14} /> PDF File
                  </span>
                </div>
              </div>

              {/* Fast 1-Click Synthetic Demo Presets (Crucial for Hackathon!) */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block">
                  {language === 'en' ? 'Or Explore Pre-Configured Test Cases:' : 'O explore casos de prueba de muestra:'}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sampleCases.map((sample) => (
                    <button
                      key={sample.id}
                      onClick={() => handleSimulateUpload(sample)}
                      className="p-3.5 rounded-2xl border border-slate-200 hover:border-brand-300 bg-slate-50 hover:bg-brand-50/40 text-left transition-all flex items-center justify-between group shadow-subtle"
                    >
                      <div>
                        <span className="font-bold text-xs text-ink-primary group-hover:text-brand-800 transition-colors block">
                          {sample.provider_name}
                        </span>
                        <span className="text-[11px] text-rose-600 font-semibold block mt-0.5">
                          ${sample.discrepancy_amount.toFixed(0)} {language === 'en' ? 'Discrepancy' : 'Discrepancia'}
                        </span>
                      </div>
                      <ArrowRight size={16} className="text-slate-400 group-hover:text-brand-600 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-ink-muted">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={16} className="text-emerald-600" />
            <span>{language === 'en' ? 'Encrypted locally on device' : 'Cifrado localmente en el dispositivo'}</span>
          </div>

          <button
            onClick={onClose}
            className="text-ink-secondary hover:text-ink-primary font-semibold"
          >
            {language === 'en' ? 'Cancel' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  );
};
