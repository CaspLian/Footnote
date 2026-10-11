import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { expectedRemaining, formatDate, formatMoney, getCaseSummary } from '@/domain';
import { useUnfoldStore } from '@/store';
import { DocumentPreview } from '@/native';
import { Badge, Button, ButtonRow, Card, Choice, Divider, Feedback, Group, Row, Screen, Section, Txt } from '@/components/ui';
import { BackendVoiceButton } from '@/native/backend-voice';
import { MissingCase, caseRoute, useCase } from './shared';
import { Icon } from '@/components/icon';
import { AgentOrbControl } from '@/components/agent-orb-control';
import { useTheme, radius, space } from '@/theme';

export function Review() {
  const { colors } = useTheme();
  const c = useCase();
  const depth = useUnfoldStore(s => s.personalContext.explanationDepth);
  const profiles = useUnfoldStore(s => s.profiles);
  const [orbCollapsed, setOrbCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  if (!c) return <MissingCase />;
  const profile = profiles.find(p => p.id === c.profileId);
  const remaining = expectedRemaining(c.financials);
  const detailed = getCaseSummary(c, 'en');
  const simple = `${c.financials.remainingCents === undefined ? 'No statement balance has been confirmed.' : `This statement asks for ${formatMoney(c.financials.remainingCents, 'en')}.`} ${c.findings.length ? `There are ${c.findings.length} questions to clarify with billing. A repeated charge or balance difference can have an explanation. Check the source documents, then ask for an itemized, reconciled statement.` : 'Use your original documents to check the service details and payments. No automated findings were generated for this review.'}`;
  const summary = depth === 'simple' ? simple : detailed;
  const original = c.attachments.find(a => a.kind === 'bill');
  return <Screen measureOverlay overlayReserve={orbCollapsed ? 68 : 136} overlayBottom={4} overlaySpace={24} testID="review" aside={original ? <Group gap={space.lg}><Txt variant="section">Original statement</Txt><DocumentPreview attachment={original} language="en" /></Group> : undefined} overlay={<AgentOrbControl billCase={c} collapsed={orbCollapsed} onCollapsedChange={setOrbCollapsed} />} footer={<Button title="Prepare request" onPress={() => caseRoute('/draft', c.id)} />}>
    <Group gap={space.lg}><Txt variant="display">Here’s the picture.</Txt><Txt muted>{c.provider} · {profile?.firstName ?? 'Unassigned profile'} · {formatDate(c.serviceDate, 'en')}</Txt></Group>
    {c.source === 'sample' ? <Badge text="Synthetic sample" /> : null}
    <Card>
      <Row label="Statement balance" value={formatMoney(c.financials.remainingCents, 'en')} /><Divider />
      <Row label="EOB responsibility" value={formatMoney(c.financials.eobResponsibilityCents, 'en')} />
      <Row label="Prior payment" value={c.financials.patientPaidCents === undefined ? '—' : '−' + formatMoney(c.financials.patientPaidCents, 'en')} />
      <Row label="Calculated remaining" value={formatMoney(remaining, 'en')} accent />
      <Txt variant="caption" muted>{remaining === undefined ? 'Confirm the EOB responsibility and prior payments before calculating a remainder. Leave unknown amounts blank.' : 'Ask billing to explain any difference. This calculation is not a promise of savings.'}</Txt>
    </Card>
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
    <Group gap={space.sm}><Choice title="Keep it simple" selected={depth === 'simple'} onPress={() => useUnfoldStore.getState().setExplanationDepth('simple')} /><Choice title="Show more detail" selected={depth === 'detailed'} onPress={() => useUnfoldStore.getState().setExplanationDepth('detailed')} /></Group>
    <Section title="What this means"><Txt>{summary}</Txt>{c.extraction?.auditId ? <BackendVoiceButton auditId={c.extraction.auditId} /> : null}</Section>
    {c.extraction ? <Section title="From your document">
      {c.extraction.mock ? <Badge text="MOCK mode: a fixed sample, not your document" /> : null}
      {c.extraction.questions.length ? <Group gap={space.sm}><Txt variant="label">Questions to ask billing</Txt>{c.extraction.questions.map((q, i) => <Txt key={i} selectable>• {q.en}</Txt>)}</Group> : <Txt muted>Gemini suggested no questions for this document.</Txt>}
    </Section> : null}
    <Section title={c.findings.length ? 'Questions worth asking' : 'Your next step'}>
      <Group gap={space.screen}>{c.findings.map((f, index) => <Group key={f.id} gap={space.lg}>
        <Pressable accessibilityRole="button" accessibilityLabel={f.title.en} onPress={() => router.push({ pathname: '/finding', params: { caseId: c.id, findingId: f.id } })} style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? .7 : 1 })}>
          <Group gap={space.md}><Group style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}><Txt variant="item" style={{ flex: 1 }}>{f.title.en}</Txt><Icon name="next" color={colors.accent} /></Group><Txt muted>{depth === 'detailed' ? f.explanation.en : f.question.en}</Txt></Group>
        </Pressable>
        {index < c.findings.length - 1 ? <Divider /> : null}
      </Group>)}</Group>
      {!c.findings.length ? <Feedback text="No supported discrepancies are shown. You can ask billing to explain the statement and prepare a question from your original documents." /> : null}
    </Section>
    <Button variant="quiet" title={expanded ? 'Hide all amounts' : 'See all amounts'} icon="document" onPress={() => setExpanded(v => !v)} />
    {expanded ? <Group gap={space.lg}>{([['Billed charges', c.financials.billedCents], ['Bill adjustments', c.financials.adjustmentCents], ['After adjustments', c.financials.postAdjustmentCents], ['Allowed amount (EOB)', c.financials.allowedCents], ['Insurer paid', c.financials.insurerPaidCents]] as const).map(([label, value]) => <Row key={label} label={label} value={formatMoney(value, 'en')} />)}</Group> : null}
  </Screen>;
}
