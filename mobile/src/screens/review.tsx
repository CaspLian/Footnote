import { findingCopy } from '@/services/finding-copy';
import { useTranslation } from '@/localization/use-translation';
import { AccessibilityInfo, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { expectedRemaining, statementRemaining, formatDate, formatMoney, getCaseSummary } from '@/domain';
import { useFootnoteStore } from '@/store';
import { DocumentPreview } from '@/native';
import { Badge, Button, ButtonRow, Card, Choice, Divider, Feedback, Group, Row, Screen, Section, Txt } from '@/components/ui';
import { BackendVoiceButton } from '@/native/backend-voice';
import { useAgentHighlight } from '@/native/agent-highlight';
import { backendConfigured, backendLocale, loadAudit } from '@/services/backend';
import { analysisChanged } from '@/domain/analysis-provenance';
import { mapGeminiAnalysis } from '@/domain/extraction';
import { DocumentsNeedProcessing, MissingCase, caseRoute, useCase } from './shared';
import { needsDocumentProcessing } from '@/domain/document-readiness';
import { Icon } from '@/components/icon';
import { AgentOrbControl } from '@/components/agent-orb-control';
import { useTheme, radius, space } from '@/theme';

export function Review() {
  const { t, formatLocale } = useTranslation();
  const { colors } = useTheme();
  const c = useCase();
  const prefs = useFootnoteStore(s => s.preferences);
  const highlight = useAgentHighlight(c?.id);
  const auditId = c?.extraction?.auditId;
  const caseId = c?.id;
  const [auditError, setAuditError] = useState('');
  useEffect(() => {
    if (!auditId || !backendConfigured()) return;
    const abort = new AbortController();
    // The persisted confirmed amounts stay intact. This checks that the saved answer can be reopened without another Gemini call.
    void loadAudit(auditId, abort.signal).then(response => {
      if (abort.signal.aborted || !caseId) return;
      const current = useFootnoteStore.getState().cases.find(item => item.id === caseId);
      if (current) useFootnoteStore.getState().setAnalysisProvenance(caseId, auditId, mapGeminiAnalysis(response, current, 'en').extraction.inputFingerprint!);
      setAuditError('');
    }).catch(() => { if (!abort.signal.aborted) setAuditError('The saved analysis could not be reopened. Your confirmed details are still available on this device.'); });
    return () => abort.abort();
  }, [auditId, caseId]);
  useEffect(() => { const finding = c?.findings.find(item => item.id === highlight); if (finding) AccessibilityInfo.announceForAccessibility(t('Footnote is showing: {0}', {0:t(finding.title.en)})); }, [highlight, c?.findings, t]);
  const depth = useFootnoteStore(s => s.personalContext.explanationDepth);
  const profiles = useFootnoteStore(s => s.profiles);
  const [orbCollapsed, setOrbCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  if (!c) return <MissingCase />;
  if (needsDocumentProcessing(c)) return <DocumentsNeedProcessing billCase={c}/>;
  const profile = profiles.find(p => p.id === c.profileId);
  const statementCalculated = statementRemaining(c.financials);
  const remaining = statementCalculated ?? (c.source === 'sample' || c.extraction?.documentsMatch === true ? expectedRemaining(c.financials) : undefined);
  const detailed = getCaseSummary(c, 'en');
  const simple = `${c.financials.remainingCents === undefined ? 'No statement balance has been confirmed.' : `This statement asks for ${formatMoney(c.financials.remainingCents, 'en')}.`} ${c.findings.length ? `There are ${c.findings.length} questions to clarify with billing. A repeated charge or balance difference can have an explanation. Check the source documents, then ask for an itemized, reconciled statement.` : 'Use your original documents to check the service details and payments. No automated findings were generated for this review.'}`;
  const summary = depth === 'simple' ? simple : detailed;
  const original = c.attachments.find(a => a.kind === 'bill') ?? c.attachments.find(a => a.kind === 'auto');
  const sourcePending = c.source === 'manual' && !!c.extraction && !c.extraction.inputFingerprint;
  return <Screen measureOverlay overlayReserve={orbCollapsed ? 68 : 136} overlayBottom={-8} overlaySpace={24} testID="review" aside={original ? <Group gap={space.lg}><Txt variant="section">Original statement</Txt><DocumentPreview attachment={original} language="en" /></Group> : undefined} overlay={<AgentOrbControl billCase={sourcePending ? { ...c, evidenceContextId: undefined } : c} collapsed={orbCollapsed} onCollapsedChange={setOrbCollapsed} />} footer={<Button title="Prepare request" onPress={() => caseRoute('/draft', c.id)} />}>
    <Group gap={space.lg}><Txt variant="display">Bill summary</Txt><Txt muted>{c.provider} · {profile?.firstName ?? 'Unassigned profile'} · {formatDate(c.serviceDate, formatLocale)}</Txt></Group>
    <Card>
      {c.financials.remainingCents === undefined && c.financials.eobResponsibilityCents === undefined && c.financials.patientPaidCents === undefined && remaining === undefined && c.financials.billedCents !== undefined ? <Row label="Billed charges" value={formatMoney(c.financials.billedCents, formatLocale)} /> : null}
      {c.financials.remainingCents !== undefined ? <><Row label="Statement balance" value={formatMoney(c.financials.remainingCents, formatLocale)} /><Divider /></> : null}
      {c.financials.eobResponsibilityCents !== undefined ? <Row label="EOB responsibility" value={formatMoney(c.financials.eobResponsibilityCents, formatLocale)} /> : null}
      {c.financials.patientPaidCents !== undefined ? <Row label="Prior payment" value={'−' + formatMoney(c.financials.patientPaidCents, formatLocale)} /> : null}
      {remaining !== undefined ? <Row label="Calculated remaining" value={formatMoney(remaining, formatLocale)} accent /> : null}
      {statementCalculated !== undefined ? <Txt variant="caption" muted>Calculated from the statement’s adjustments and recorded payments.</Txt> : null}
      {remaining !== undefined ? <Txt variant="caption" muted>Ask billing to explain any difference. This calculation is not a promise of savings.</Txt> : null}
    </Card>
    {c.extraction?.documentMismatchReason ? <Feedback title={c.extraction.documentsMatch === false ? 'Check that these documents belong together' : 'How the bill and the EOB differ'} text={c.extraction.documentMismatchReason.en} /> : null}
    {c.extraction && c.extraction.financialsVersion !== 1 ? <Button title="Review documents again" icon="document" variant="secondary" onPress={() => caseRoute('/confirm-documents', c.id)} /> : null}
    <Group gap={space.md}>
      <Txt variant="label" muted>Manage this review</Txt>
      <Card style={{ padding: space.lg, gap: space.lg }}>
        <ButtonRow><Button variant="secondary" material="glass" title="Edit details" icon="edit" style={{ flexDirection: 'column', gap: space.sm, minHeight: 84, paddingHorizontal: space.sm }} onPress={() => caseRoute('/verify', c.id)} /><Button variant="secondary" material="glass" title="Add document" icon="plus" style={{ flexDirection: 'column', gap: space.sm, minHeight: 84, paddingHorizontal: space.sm }} onPress={() => caseRoute('/intake', c.id)} /></ButtonRow>
        <Divider />
        <Pressable accessibilityRole="button" accessibilityLabel="Timeline. View this case’s progress and follow-ups" onPress={() => caseRoute('/timeline', c.id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, padding: space.sm, borderRadius: radius.small, backgroundColor: pressed ? colors.accentSoft : 'transparent' })}>
          <Icon name="calendar" color={colors.accent} size={24} /><Group gap={space.xs} style={{ flex: 1 }}><Txt variant="label">Timeline</Txt><Txt variant="caption" muted>Progress, reminders and recorded actions</Txt></Group><Icon name="next" color={colors.muted} size={20} />
        </Pressable>
      </Card>
    </Group>
    <Group gap={space.sm}><Choice title="Keep it simple" selected={depth === 'simple'} onPress={() => useFootnoteStore.getState().setExplanationDepth('simple')} /><Choice title="Show more detail" selected={depth === 'detailed'} onPress={() => useFootnoteStore.getState().setExplanationDepth('detailed')} /></Group>
    <Section title="What this means"><Txt>{summary}</Txt>{c.extraction?.auditId && !sourcePending && !analysisChanged(c) && backendConfigured() ? <BackendVoiceButton auditId={c.extraction.auditId} voice={prefs.voice} language={c.extraction.language ?? backendLocale(prefs.workingLanguage)} /> : null}</Section>
    {sourcePending && backendConfigured() ? <Txt variant="caption" muted>Checking the saved source before enabling its audio and live bill conversation.</Txt> : null}
    {c.extraction && analysisChanged(c) ? <Feedback text="Your confirmed details differ from the saved document reading. The original audio and live bill conversation are paused so they do not describe old amounts. Use the confirmed review and ask billing about the correction." /> : null}
    {auditError ? <Feedback text={auditError} /> : null}
    {c.extraction ? <Section title="From your document">
      {c.extraction.mock ? <Badge text="Document reading unavailable: this result does not describe your document" /> : null}
      {c.extraction.questions.length ? <Group gap={space.sm}><Txt variant="label">Questions to ask billing</Txt>{c.extraction.questions.map((q, i) => <Txt key={i} selectable>• {q.en}</Txt>)}</Group> : <Txt muted>Gemini suggested no questions for this document.</Txt>}
    </Section> : null}
    <Section title={c.findings.length ? 'Questions worth asking' : 'Your next step'}>
      <Group gap={space.screen}>{c.findings.map((f, index) => { const text=findingCopy(f,c.lineItems.find(line=>f.id===`price-${line.id}`),t); return <Group key={f.id} gap={space.lg}>
        <Pressable accessibilityRole="button" accessibilityLabel={text.title} testID={f.id === highlight ? 'finding-highlighted' : undefined} onPress={() => router.push({ pathname: '/finding', params: { caseId: c.id, findingId: f.id } })} style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? .7 : 1, backgroundColor: f.id === highlight ? colors.accentSoft : 'transparent', borderRadius: radius.small })}>
          <Group gap={space.md}><Group style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}><Txt variant="item" style={{ flex: 1 }}>{text.title}</Txt><Icon name="next" color={colors.accent} /></Group><Txt muted>{depth === 'detailed' ? text.explanation : text.question}</Txt></Group>
        </Pressable>
        {index < c.findings.length - 1 ? <Divider /> : null}
      </Group>; })}</Group>
      {!c.findings.length ? <Feedback text="No supported discrepancies are shown. You can ask billing to explain the statement and prepare a question from your original documents." /> : null}
    </Section>
    <Button variant="quiet" title={expanded ? 'Hide all amounts' : 'See all amounts'} icon="document" onPress={() => setExpanded(v => !v)} />
    {expanded ? <Group gap={space.lg}>{([['Billed charges', c.financials.billedCents], ['Bill adjustments', c.financials.adjustmentCents], ['After adjustments', c.financials.postAdjustmentCents], ['Allowed amount (EOB)', c.financials.allowedCents], ['Insurer paid', c.financials.insurerPaidCents], ['Billed charges (EOB)', c.financials.eobBilledCents], ['Insurer paid (EOB)', c.financials.eobInsurerPaidCents]] as const).filter(([,value])=>value!==undefined).map(([label, value]) => <Row key={label} label={label} value={formatMoney(value, formatLocale)} />)}</Group> : null}
  </Screen>;
}
