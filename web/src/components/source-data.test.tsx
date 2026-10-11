import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { analysisFixture } from '../services/test-fixtures';
import { toConnectedCase } from '../services/analysis-mapping';
import { ReviewView } from './ReviewView';
import { VerificationView } from './VerificationView';
import { CallScriptView } from './CallScriptView';
import { Dashboard } from './Dashboard';
import { FindingModal } from './FindingModal';

const noop = () => {};

describe('uploaded bill screens', () => {
  const bill = toConnectedCase(analysisFixture(), [{ name: 'my-bill.pdf', size: 6000 }], 'en');

  it.each(['en', 'es'] as const)('uses actual amounts and questions without the former example claims (%s)', language => {
    const screens = [
      <ReviewView caseData={bill} language={language} onNavigateTab={noop} onSelectFinding={noop} />,
      <VerificationView caseData={bill} language={language} onNavigateTab={noop} onUpdateCase={noop} />,
      <CallScriptView caseData={bill} language={language} onNavigateTab={noop} />,
      <Dashboard cases={[bill]} activeCase={bill} language={language} onSelectCase={noop} onNavigateTab={noop} onOpenIntake={noop} />,
    ].map(screen => renderToStaticMarkup(screen));
    for (const html of screens) {
      expect(html).toContain('Metropolitan Medical Center');
      for (const stale of ['$494', '$294', '$244', '$250', '80053 Metabolic Panel', '100%', 'Oct 16, 2026', 'PDF SPECIMEN']) {
        expect(html).not.toContain(stale);
      }
    }
    expect(screens[0]).toContain('4,490.00');
    expect(screens[1]).toContain('3,200.00');
    expect(screens[1]).toContain('my-bill.pdf');
    expect(screens[1]).toContain('All (3)'.replace('All', language === 'es' ? 'Todos' : 'All'));
    expect(screens[2]).toContain(language === 'en' ? 'Can you explain the charge for' : '¿Pueden explicarme el cargo');
  });

  it('shows unknown balances instead of zeros, while keeping a documented zero', () => {
    const response = analysisFixture();
    response.result = { ...response.result, total_billed: null, amount_patient_owes: null };
    const unknown = toConnectedCase(response, [], 'en');
    const render = (caseData: typeof unknown) => renderToStaticMarkup(<ReviewView caseData={caseData} language="en" onNavigateTab={noop} onSelectFinding={noop} />);
    expect(render(unknown)).toContain('Not available');
    expect(render(unknown)).not.toContain('$0.00');
    expect(render({ ...unknown, statement_balance: 0 })).toContain('$0.00');
  });

  it('shows the finding evidence without an invented benchmark grid', () => {
    const finding = bill.findings.find(f => f.cpt_code === '70450')!;
    const html = renderToStaticMarkup(<FindingModal finding={finding} language="en" onClose={noop} onPrepareDispute={noop} />);
    expect(html).toContain('3,200.00');
    expect(html).toContain('106.03');
    expect(html).not.toContain('$68.00');
    expect(html).not.toContain('367%');
    expect(html).not.toContain('High Priority');
  });

  it('starts empty without fabricated balances or deadlines', () => {
    const html = renderToStaticMarkup(<Dashboard cases={[]} language="en" onSelectCase={noop} onNavigateTab={noop} onOpenIntake={noop} />);
    expect(html).toContain('Add documents');
    expect(html).not.toContain('Statement balance');
    expect(html).not.toContain('Follow-up');
  });
});
