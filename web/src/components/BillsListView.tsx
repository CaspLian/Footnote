import { formatMoney } from '../services/format';
import React, { useState } from 'react';
import { MedicalCase, Language, ActiveTab, CaseStatus } from '../types';
import { 
  MagnifyingGlass, 
  FileText, 
  Plus, 
  ArrowRight, 
  WarningCircle, 
  CheckCircle, 
  Clock, 
  CalendarBlank 
} from '@phosphor-icons/react';

interface BillsListViewProps {
  cases: MedicalCase[];
  language: Language;
  onSelectCase: (id: string) => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenIntake: () => void;
}

export const BillsListView: React.FC<BillsListViewProps> = ({
  cases,
  language,
  onSelectCase,
  onNavigateTab,
  onOpenIntake,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.provider_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.account_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.facility_type.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-primary tracking-tight">
            {language === 'en' ? 'My Medical Bills & Claims' : 'Mis Cuentas Médicas y Reclamos'}
          </h1>
          <p className="text-sm text-ink-secondary mt-0.5">
            {language === 'en'
              ? 'Track hospital statements, reconcile EOBs, and monitor dispute deadlines.'
              : 'Gestione estados de cuenta, concilie EOBs y monitoree plazos de reclamo.'}
          </p>
        </div>

        <button
          onClick={onOpenIntake}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-subtle hover:shadow-card transition-all"
        >
          <Plus size={16} weight="bold" />
          <span>{language === 'en' ? 'Add New Statement' : 'Agregar Nueva Cuenta'}</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={language === 'en' ? 'Search by hospital, account #...' : 'Buscar por hospital o cuenta...'}
            className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: language === 'en' ? 'All (2)' : 'Todos (2)' },
            { id: 'needs_clarification', label: language === 'en' ? 'Flagged (1)' : 'Señalados (1)' },
            { id: 'in_dispute', label: language === 'en' ? 'In Dispute (1)' : 'En Disputa (1)' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setStatusFilter(pill.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === pill.id
                  ? 'bg-brand-600 text-white shadow-subtle'
                  : 'bg-slate-100 text-ink-secondary hover:bg-slate-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cases List */}
      <div className="space-y-4">
        {filteredCases.map((c) => (
          <div
            key={c.id}
            onClick={() => {
              onSelectCase(c.id);
              onNavigateTab('review');
            }}
            className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-subtle hover:shadow-card transition-all cursor-pointer group border-l-4 border-l-brand-600"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      c.status === 'needs_clarification'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-brand-50 text-brand-800 border border-brand-200'
                    }`}
                  >
                    {c.status === 'needs_clarification'
                      ? (language === 'en' ? 'Needs Clarification' : 'Requiere Aclaración')
                      : (language === 'en' ? 'In Dispute' : 'En Disputa')}
                  </span>

                  <span className="text-xs font-mono text-ink-muted">
                    Acct #{c.account_number}
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-ink-primary group-hover:text-brand-800 transition-colors">
                  {c.provider_name}
                </h3>

                <p className="text-xs text-ink-secondary">
                  {c.facility_type} · Service Date: {c.service_date} · Statement Date: {c.statement_date}
                </p>

                {c.follow_up_date && (
                  <div className="flex items-center gap-1.5 text-xs text-brand-700 font-medium pt-1">
                    <CalendarBlank size={15} />
                    <span>
                      {language === 'en'
                        ? `Follow-up deadline: ${c.follow_up_date}`
                        : `Plazo de seguimiento: ${c.follow_up_date}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Financial Snapshot */}
              <div className="flex items-center gap-6 justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                <div>
                  <span className="text-xs text-ink-muted block">
                    {language === 'en' ? 'Statement Billed' : 'Monto Facturado'}
                  </span>
                  <span className="text-sm font-bold text-ink-primary tabular-nums">
                    {formatMoney(c.statement_balance, language)}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-rose-600 font-semibold block">
                    {language === 'en' ? 'Questions' : 'Preguntas'}
                  </span>
                  <span className="text-base font-extrabold text-rose-600 tabular-nums">
                    {c.findings.length}
                  </span>
                </div>

                <div className="hidden sm:flex items-center gap-1 text-xs font-semibold text-brand-700 group-hover:translate-x-0.5 transition-transform">
                  <span>{language === 'en' ? 'Audit Details' : 'Ver Detalles'}</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredCases.length === 0 && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center text-ink-muted">
            <FileText size={36} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold">{language === 'en' ? 'No cases found matching your search' : 'No se encontraron cuentas'}</p>
          </div>
        )}
      </div>
    </div>
  );
};
