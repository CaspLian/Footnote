import React from 'react';
import { MedicalCase, Language, ActiveTab } from '../types';
import { 
  FileText, 
  CalendarBlank, 
  ArrowRight, 
  Sparkle, 
  WarningCircle, 
  CheckCircle, 
  HourglassMedium,
  CurrencyDollar,
  TrendUp,
  FileArrowUp
} from '@phosphor-icons/react';

interface DashboardProps {
  cases: MedicalCase[];
  activeCase: MedicalCase;
  language: Language;
  onSelectCase: (id: string) => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenIntake: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  cases,
  activeCase,
  language,
  onSelectCase,
  onNavigateTab,
  onOpenIntake,
}) => {
  const totalSavings = cases.reduce((acc, c) => acc + c.discrepancy_amount, 0);
  const totalFindings = cases.reduce((acc, c) => acc + c.findings.length, 0);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Welcome & Mission Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 border border-brand-200/80 px-2.5 py-1 rounded-full inline-block mb-2">
            {language === 'en' ? 'Forensic Patient Advocacy' : 'Defensa Forense del Paciente'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-primary tracking-tight">
            {language === 'en' ? 'Make sense of your medical bill.' : 'Comprenda su cuenta médica.'}
          </h1>
          <p className="text-sm sm:text-base text-ink-secondary mt-1 max-w-2xl">
            {language === 'en'
              ? 'Bring your hospital statement and insurer EOB together. Spot overcharges, compare fair regional prices, and prepare legal appeals.'
              : 'Compare su factura de hospital con la explicación de beneficios (EOB). Detecte cobros duplicados y prepare disputas formales.'}
          </p>
        </div>

        {/* Quick Language Stat Tag */}
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{language === 'en' ? 'HIPAA Safe Harbor Compliant' : 'Conforme con Privacidad HIPAA'}</span>
        </div>
      </div>

      {/* Hero Action Card (Deepened shadow & crisp borders) */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-50/90 via-white to-teal-50/40 border border-brand-200/90 rounded-3xl p-6 sm:p-8 shadow-card hover:shadow-elevated transition-all border-l-4 border-l-brand-600">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-800 border border-brand-200">
              {language === 'en' ? 'Step 1: Document Reconciliation' : 'Paso 1: Conciliación Documental'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-ink-primary tracking-tight">
            {language === 'en' ? 'A clearer next step for your medical expenses' : 'Un paso claro para sus gastos médicos'}
          </h2>
          <p className="text-sm sm:text-base text-ink-secondary mt-2 leading-relaxed">
            {language === 'en'
              ? 'Most hospital statements demand full balance before accounting for your insurer’s in-network discount or prior copays. Unfold analyzes CPT billing codes, checks Medicare pricing benchmarks, and spots unauthorized charges.'
              : 'La mayoría de los hospitales reclaman el saldo total sin aplicar los descuentos de la aseguradora. Unfold analiza códigos CPT y detecta cobros no autorizados.'}
          </p>

          {/* Varied Button Sizes and Weights */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenIntake}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-semibold text-sm px-5 py-3 rounded-xl shadow-subtle hover:shadow-card transition-all"
            >
              <FileArrowUp size={18} weight="bold" />
              <span>{language === 'en' ? 'Upload Bill & EOB' : 'Subir Factura y EOB'}</span>
            </button>

            <button
              onClick={() => {
                onSelectCase('case-northline-001');
                onNavigateTab('review');
              }}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-brand-800 border border-slate-300 font-semibold text-sm px-4 py-3 rounded-xl shadow-subtle transition-all"
            >
              <Sparkle size={18} className="text-brand-600" />
              <span>{language === 'en' ? 'Explore Sample Case ($250 Savings)' : 'Explorar Caso de Muestra ($250)'}</span>
            </button>
          </div>
        </div>

        {/* Subtle Decorative Background Specimen Stamp */}
        <div className="hidden lg:block absolute right-8 top-1/2 -translate-y-1/2 p-6 rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200/90 shadow-subtle text-xs text-ink-secondary max-w-xs pointer-events-none">
          <div className="font-mono text-[10px] text-ink-muted uppercase border-b border-slate-100 pb-2 mb-2 flex justify-between">
            <span>AUDIT SPECIMEN</span>
            <span className="text-emerald-600 font-semibold">VERIFIED</span>
          </div>
          <p className="font-semibold text-ink-primary">Northline Medical Center</p>
          <div className="mt-2 space-y-1 font-mono text-[11px]">
            <div className="flex justify-between">
              <span>Billed Charge:</span>
              <span className="tabular-nums font-semibold">$2,670.00</span>
            </div>
            <div className="flex justify-between text-rose-600 font-semibold">
              <span>Duplicate CPT 80053:</span>
              <span className="tabular-nums">-$250.00</span>
            </div>
            <div className="flex justify-between text-brand-700 font-bold pt-1 border-t border-slate-100">
              <span>True Owed:</span>
              <span className="tabular-nums">$244.00</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-subtle">
          <div className="flex items-center justify-between text-ink-muted mb-1">
            <span className="text-xs font-medium">{language === 'en' ? 'Active Cases' : 'Casos Activos'}</span>
            <FileText size={18} className="text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-ink-primary tabular-nums">{cases.length}</div>
          <span className="text-[11px] text-ink-muted mt-1 block">
            {language === 'en' ? 'Statements under review' : 'Facturas en revisión'}
          </span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-subtle border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between text-ink-muted mb-1">
            <span className="text-xs font-medium">{language === 'en' ? 'Discrepancies' : 'Discrepancias'}</span>
            <WarningCircle size={18} className="text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 tabular-nums">{totalFindings}</div>
          <span className="text-[11px] text-rose-600 font-medium mt-1 block">
            {language === 'en' ? 'Potential billing errors' : 'Posibles errores detectados'}
          </span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-subtle border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-ink-muted mb-1">
            <span className="text-xs font-medium">{language === 'en' ? 'Identified Savings' : 'Ahorro Identificado'}</span>
            <CurrencyDollar size={18} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 tabular-nums">${totalSavings.toFixed(2)}</div>
          <span className="text-[11px] text-emerald-700 font-medium mt-1 block">
            {language === 'en' ? 'Overcharges to dispute' : 'Cargos para disputar'}
          </span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-subtle">
          <div className="flex items-center justify-between text-ink-muted mb-1">
            <span className="text-xs font-medium">{language === 'en' ? 'Credit Defense' : 'Defensa Crediticia'}</span>
            <TrendUp size={18} className="text-brand-500" />
          </div>
          <div className="text-2xl font-bold text-brand-700 tabular-nums">100%</div>
          <span className="text-[11px] text-ink-muted mt-1 block">
            {language === 'en' ? 'No collections referrals' : 'Sin envíos a cobranzas'}
          </span>
        </div>
      </div>

      {/* Main Grid: Active Case Deep-Dive & Next Follow-up Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Case Spotlight */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-subtle">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-semibold text-brand-700 uppercase tracking-wider">
                {language === 'en' ? 'Spotlight Case' : 'Caso Destacado'}
              </span>
              <h3 className="text-lg font-bold text-ink-primary mt-0.5">
                {activeCase.provider_name}
              </h3>
              <p className="text-xs text-ink-muted">
                {activeCase.facility_type} · {activeCase.service_date} · Account #{activeCase.account_number}
              </p>
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <HourglassMedium size={14} />
              {language === 'en' ? 'Needs Clarification' : 'Requiere Aclaración'}
            </span>
          </div>

          {/* Statement vs EOB Reconciliation Comparison */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-xs text-ink-muted block">
                {language === 'en' ? 'Statement Demanded' : 'Factura Exigida'}
              </span>
              <span className="text-xl font-bold text-ink-primary tabular-nums mt-1 block">
                ${activeCase.statement_balance.toFixed(2)}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-xs text-ink-muted block">
                {language === 'en' ? 'EOB True Responsibility' : 'Responsabilidad EOB'}
              </span>
              <span className="text-xl font-bold text-ink-primary tabular-nums mt-1 block">
                ${activeCase.eob_responsibility.toFixed(2)}
              </span>
              <span className="text-[10px] text-ink-muted block mt-0.5">
                (less ${activeCase.patient_paid.toFixed(2)} prior copay)
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/80">
              <span className="text-xs text-rose-700 font-semibold block">
                {language === 'en' ? 'Identified Discrepancy' : 'Discrepancia Detectada'}
              </span>
              <span className="text-xl font-bold text-rose-600 tabular-nums mt-1 block">
                ${activeCase.discrepancy_amount.toFixed(2)}
              </span>
              <span className="text-[10px] text-rose-600 font-medium block mt-0.5">
                {activeCase.findings.length} {language === 'en' ? 'errors found' : 'errores detectados'}
              </span>
            </div>
          </div>

          {/* Quick Line Item Preview */}
          <div className="mt-5 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              {language === 'en' ? 'Flagged Errors in this Case' : 'Errores Señalados en este Caso'}
            </span>
            {activeCase.findings.map((f) => (
              <div
                key={f.id}
                className="flex items-start justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-200/60 hover:bg-slate-100/60 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0"></span>
                  <div>
                    <h4 className="text-xs font-semibold text-ink-primary">{f.title}</h4>
                    <p className="text-[11px] text-ink-secondary mt-0.5">{f.summary}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-rose-600 tabular-nums shrink-0 ml-2">
                  +${f.potential_savings.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* Action Row */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => onNavigateTab('verification')}
              className="text-xs font-semibold text-ink-secondary hover:text-ink-primary hover:underline transition-colors"
            >
              {language === 'en' ? 'Inspect Extracted Fields →' : 'Inspeccionar Campos Extraídos →'}
            </button>

            <button
              onClick={() => onNavigateTab('review')}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-subtle transition-colors"
            >
              <span>{language === 'en' ? 'View Full Audit Report' : 'Ver Informe Forense Completo'}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Right Col: Follow-Up & Action Timeline */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-brand-700 mb-1">
              <CalendarBlank size={18} weight="bold" />
              <span className="text-xs font-bold uppercase tracking-wider">
                {language === 'en' ? 'Follow-Up Guardian' : 'Guardián de Seguimiento'}
              </span>
            </div>
            <h3 className="text-base font-bold text-ink-primary">
              {language === 'en' ? 'Next Contact Milestone' : 'Próxima Fecha de Contacto'}
            </h3>
            <p className="text-xs text-ink-secondary mt-1">
              {language === 'en'
                ? 'Setting a reminder protects your credit report and creates a timestamped paper trail before collections referrals.'
                : 'Programar un recordatorio protege su historial crediticio y crea un registro documentado.'}
            </p>

            {/* Target Date Box */}
            <div className="mt-4 p-4 rounded-xl bg-brand-50/70 border border-brand-200/80">
              <span className="text-xs text-brand-800 font-semibold block">
                {language === 'en' ? 'Scheduled Follow-Up:' : 'Seguimiento Programado:'}
              </span>
              <span className="text-lg font-extrabold text-brand-900 mt-0.5 block">
                {activeCase.follow_up_date || 'Oct 16, 2026'}
              </span>
              <span className="text-[11px] text-brand-700 block mt-1">
                {language === 'en' ? '7 days remaining to call billing' : 'Quedan 7 días para llamar a facturación'}
              </span>
            </div>

            {/* Status Checklist */}
            <div className="mt-4 space-y-2 text-xs text-ink-secondary">
              <div className="flex items-center gap-2">
                <CheckCircle size={15} weight="fill" className="text-emerald-500" />
                <span>{language === 'en' ? 'Statement & EOB documents parsed' : 'Factura y EOB analizadas'}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={15} weight="fill" className="text-emerald-500" />
                <span>{language === 'en' ? 'Discrepancy letter drafted' : 'Carta de disputa redactada'}</span>
              </div>
              <div className="flex items-center gap-2 text-amber-700 font-medium">
                <HourglassMedium size={15} weight="bold" />
                <span>{language === 'en' ? 'Billing call pending' : 'Llamada a facturación pendiente'}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              onClick={() => onNavigateTab('call-script')}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold py-2.5 rounded-xl shadow-subtle transition-colors"
            >
              <span>{language === 'en' ? 'Open Phone Negotiation Script' : 'Abrir Guión Telefónico'}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Cases Grouped Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-subtle">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-ink-primary">
              {language === 'en' ? 'All Document Audits' : 'Todas las Auditorías de Cuentas'}
            </h3>
            <p className="text-xs text-ink-muted">
              {language === 'en' ? 'Click any case to inspect line items or edit dispute letter' : 'Haga clic en un caso para ver los detalles'}
            </p>
          </div>

          <button
            onClick={() => onNavigateTab('bills')}
            className="text-xs font-semibold text-brand-700 hover:text-brand-800 transition-colors"
          >
            {language === 'en' ? 'View all bills →' : 'Ver todas las facturas →'}
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {cases.map((c) => (
            <div
              key={c.id}
              onClick={() => {
                onSelectCase(c.id);
                onNavigateTab('review');
              }}
              className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 -mx-6 px-6 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-brand-50 text-slate-600 group-hover:text-brand-700 flex items-center justify-center shrink-0 transition-colors">
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-ink-primary group-hover:text-brand-800 transition-colors">
                    {c.provider_name}
                  </h4>
                  <p className="text-xs text-ink-muted">
                    {c.facility_type} · {c.service_date}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:gap-6 justify-between sm:justify-end">
                <div className="text-left sm:text-right">
                  <span className="text-xs text-ink-muted block">
                    {language === 'en' ? 'Patient Balance' : 'Saldo del Paciente'}
                  </span>
                  <span className="text-sm font-bold text-ink-primary tabular-nums">
                    ${c.statement_balance.toFixed(2)}
                  </span>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-xs text-rose-600 font-medium block">
                    {language === 'en' ? 'Discrepancy' : 'Discrepancia'}
                  </span>
                  <span className="text-sm font-bold text-rose-600 tabular-nums">
                    +${c.discrepancy_amount.toFixed(2)}
                  </span>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    c.status === 'needs_clarification'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-brand-50 text-brand-700 border border-brand-200'
                  }`}
                >
                  {c.status === 'needs_clarification'
                    ? (language === 'en' ? 'Needs Clarification' : 'Requiere Aclaración')
                    : (language === 'en' ? 'In Dispute' : 'En Disputa')}
                </span>

                <ArrowRight size={16} className="text-slate-300 group-hover:text-brand-600 transition-colors hidden sm:block" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
