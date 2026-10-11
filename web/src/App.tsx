import React, { useState } from 'react';
import { ActiveTab, Language, MedicalCase, Finding } from './types';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { VerificationView } from './components/VerificationView';
import { ReviewView } from './components/ReviewView';
import { DisputeWorkspace } from './components/DisputeWorkspace';
import { CallScriptView } from './components/CallScriptView';
import { BillsListView } from './components/BillsListView';
import { GuideView } from './components/GuideView';
import { IntakeModal } from './components/IntakeModal';
import { FindingModal } from './components/FindingModal';
import { ShieldCheck, Heart } from '@phosphor-icons/react';

export const App: React.FC = () => {
  const [cases, setCases] = useState<MedicalCase[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<ActiveTab>('dashboard');
  const [language, setLanguage] = useState<Language>('en');
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  const activeCase = cases.find((c) => c.id === activeCaseId) || cases[0];

  const handleUpdateCase = (updated: MedicalCase) => {
    setCases((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  };

  const handleCaseParsed = (newCase: MedicalCase) => {
    // Check if case already exists
    if (!cases.find((c) => c.id === newCase.id)) {
      setCases((prev) => [newCase, ...prev]);
    }
    setActiveCaseId(newCase.id);
    setCurrentTab('verification');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF8] text-ink-primary">
      {/* Sticky Top Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        language={language}
        setLanguage={setLanguage}
        cases={cases}
        activeCaseId={activeCaseId}
        setActiveCaseId={setActiveCaseId}
        onOpenIntake={() => setIsIntakeOpen(true)}
      />

      {/* Main App Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {currentTab === 'dashboard' && (
          <Dashboard
            cases={cases}
            activeCase={activeCase}
            language={language}
            onSelectCase={(id) => setActiveCaseId(id)}
            onNavigateTab={(tab) => setCurrentTab(tab)}
            onOpenIntake={() => setIsIntakeOpen(true)}
          />
        )}

        {currentTab === 'bills' && (
          <BillsListView
            cases={cases}
            language={language}
            onSelectCase={(id) => setActiveCaseId(id)}
            onNavigateTab={(tab) => setCurrentTab(tab)}
            onOpenIntake={() => setIsIntakeOpen(true)}
          />
        )}

        {currentTab === 'verification' && activeCase && (
          <VerificationView
            key={activeCase.id}
            caseData={activeCase}
            language={language}
            onNavigateTab={(tab) => setCurrentTab(tab)}
            onUpdateCase={handleUpdateCase}
          />
        )}

        {currentTab === 'review' && activeCase && (
          <ReviewView
            caseData={activeCase}
            language={language}
            onNavigateTab={(tab) => setCurrentTab(tab)}
            onSelectFinding={(f) => setSelectedFinding(f)}
          />
        )}

        {currentTab === 'dispute' && activeCase && (
          <DisputeWorkspace
            key={`${activeCase.id}:${language}`}
            caseData={activeCase}
            language={language}
            onNavigateTab={(tab) => setCurrentTab(tab)}
            onUpdateCase={handleUpdateCase}
          />
        )}

        {currentTab === 'call-script' && activeCase && (
          <CallScriptView
            key={activeCase.id}
            caseData={activeCase}
            language={language}
            onNavigateTab={(tab) => setCurrentTab(tab)}
          />
        )}

        {currentTab === 'guide' && (
          <GuideView language={language} />
        )}
      </main>

      {/* Modals & Overlays */}
      <IntakeModal
        isOpen={isIntakeOpen}
        onClose={() => setIsIntakeOpen(false)}
        language={language}
        onCaseParsed={handleCaseParsed}
      />

      <FindingModal
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
        language={language}
        onPrepareDispute={() => setCurrentTab('dispute')}
      />

      {/* Trust & Sponsor Footer */}
      <footer className="mt-auto border-t border-slate-200/80 bg-white py-6 text-xs text-ink-muted no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-brand-600" />
            <span>
              {language === 'en'
                ? 'Footnote · Understand your medical bill. Prepare your next step.'
                : 'Footnote · Entiende tu factura médica. Prepara tu siguiente paso.'}
            </span>
          </div>

          {/* Hackathon Sponsor Track Badges */}
          <div className="flex items-center flex-wrap gap-2 text-[11px] font-mono text-slate-500">
            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">Gemini Vision</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">Snowflake Benchmarks</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">ElevenLabs Audio</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">Tiger Data</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
export default App;
