import React from 'react';
import { ActiveTab, Language, MedicalCase } from '../types';
import { 
  FileText, 
  House, 
  Files, 
  BookOpen, 
  Plus, 
  Globe, 
  ShieldCheck,
  CheckCircle,
  PhoneCall,
  Scales
} from '@phosphor-icons/react';

interface HeaderProps {
  currentTab: ActiveTab;
  setCurrentTab: (tab: ActiveTab) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  cases: MedicalCase[];
  activeCaseId: string;
  setActiveCaseId: (id: string) => void;
  onOpenIntake: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  language,
  setLanguage,
  cases,
  activeCaseId,
  setActiveCaseId,
  onOpenIntake,
}) => {
  const activeCase = cases.find((c) => c.id === activeCaseId) || cases[0];

  const navItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: language === 'en' ? 'Dashboard' : 'Panel',
      icon: House,
    },
    {
      id: 'bills' as ActiveTab,
      label: language === 'en' ? 'My Bills' : 'Mis Facturas',
      icon: Files,
    },
    {
      id: 'verification' as ActiveTab,
      label: language === 'en' ? 'Verify Details' : 'Verificar',
      icon: CheckCircle,
    },
    {
      id: 'review' as ActiveTab,
      label: language === 'en' ? 'Audit & Review' : 'Auditoría',
      icon: FileText,
      badge: activeCase ? `$${activeCase.discrepancy_amount.toFixed(0)}` : undefined,
    },
    {
      id: 'dispute' as ActiveTab,
      label: language === 'en' ? 'Dispute Letter' : 'Carta de Disputa',
      icon: Scales,
    },
    {
      id: 'call-script' as ActiveTab,
      label: language === 'en' ? 'Phone Script' : 'Guión Telefónico',
      icon: PhoneCall,
    },
    {
      id: 'guide' as ActiveTab,
      label: language === 'en' ? 'Insurance Guide' : 'Guía de Seguros',
      icon: BookOpen,
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-subtle no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className="flex items-center gap-2.5 group text-left focus:outline-none"
            >
              <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-subtle group-hover:bg-brand-700 transition-colors">
                <ShieldCheck size={22} weight="duotone" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-lg text-ink-primary tracking-tight">Unfold</span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200/60">
                    Audit AI
                  </span>
                </div>
                <p className="text-[11px] text-ink-muted hidden sm:block -mt-0.5">
                  {language === 'en' ? 'Medical Bill Transparency' : 'Claridad en Cuentas Médicas'}
                </p>
              </div>
            </button>

            {/* Case Selector Dropdown */}
            <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-slate-200">
              <span className="text-xs font-medium text-ink-muted">
                {language === 'en' ? 'Active Case:' : 'Caso Activo:'}
              </span>
              <select
                value={activeCaseId}
                onChange={(e) => setActiveCaseId(e.target.value)}
                className="text-xs font-semibold text-ink-primary bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.provider_name} (${c.statement_balance.toFixed(0)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <div className="flex items-center bg-slate-100 border border-slate-200/80 rounded-lg p-0.5 text-xs font-medium">
              <button
                onClick={() => setLanguage('en')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                  language === 'en'
                    ? 'bg-white text-brand-700 shadow-sm font-semibold'
                    : 'text-ink-secondary hover:text-ink-primary'
                }`}
                title="English"
              >
                <Globe size={13} />
                <span>EN</span>
              </button>
              <button
                onClick={() => setLanguage('es')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                  language === 'es'
                    ? 'bg-white text-brand-700 shadow-sm font-semibold'
                    : 'text-ink-secondary hover:text-ink-primary'
                }`}
                title="Español"
              >
                <span>ES</span>
              </button>
            </div>

            {/* New Intake CTA */}
            <button
              onClick={onOpenIntake}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-xl shadow-subtle hover:shadow-card transition-all"
            >
              <Plus size={16} weight="bold" />
              <span>{language === 'en' ? 'Scan New Bill' : 'Escanear Cuenta'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex space-x-1 overflow-x-auto py-2 -mb-px border-t border-slate-100 no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-brand-50 text-brand-800 border border-brand-200/70 font-semibold shadow-subtle'
                    : 'text-ink-secondary hover:text-ink-primary hover:bg-slate-50'
                }`}
              >
                <Icon
                  size={16}
                  weight={isActive ? 'fill' : 'regular'}
                  className={isActive ? 'text-brand-600' : 'text-slate-400'}
                />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
