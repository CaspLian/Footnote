import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { glossary } from '@/domain';
import { guideExplanationService, type GuideExplanation } from '@/services/guide-explanations';
import { useFootnoteStore } from '@/store';
import { copyDraft } from '@/native';
import { Button, ButtonRow, Card, Choice, Feedback, Group, Screen, Section, Txt } from '@/components/ui';
import { FootnoteLoader } from '@/components/loader';

import { AgentOrbControl } from '@/components/agent-orb-control';
import { space } from '@/theme';
import { useTranslation } from '@/localization/use-translation';
export function TermDetail() {
  const { termId } = useLocalSearchParams<{ termId: string }>();
  const depth = useFootnoteStore(s => s.personalContext.explanationDepth);
  const voice = useFootnoteStore(s => s.preferences.voice);
  return <TermDetailContent key={`${termId}:${depth}:${voice}`} termId={termId} />;
}
function TermDetailContent({ termId }: { termId: string }) {
  const { t } = useTranslation();
  const term = glossary.find(t => t.id === termId);
  const depth = useFootnoteStore(s => s.personalContext.explanationDepth);
  const prefs = useFootnoteStore(s => s.preferences);
  const saved = useFootnoteStore(s => s.savedTermIds.includes(termId));
  const [orbCollapsed,setOrbCollapsed] = useState(false);
  const [explanation, setExplanation] = useState<GuideExplanation>();
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    guideExplanationService.prepare({ termId, language: 'en', depth, voice: prefs.voice }).then(value => { if (active) { setExplanation(value); setError(''); } }).catch(() => { if (active) setError('This explanation could not be loaded. Try again.'); });
    return () => { active = false; };
  }, [termId, depth, prefs.voice, retry]);
  if (!term) return <Screen><Feedback title="This term is unavailable" text="Open Guide to browse the insurance glossary." action={{ title: 'Open Guide', onPress: () => router.replace('/(tabs)/guide') }} /></Screen>;
  return <Screen measureOverlay overlayReserve={orbCollapsed?68:136} overlayBottom={-8} overlaySpace={24} contentWidth={720} testID="term-detail" overlay={explanation ? <AgentOrbControl collapsed={orbCollapsed} onCollapsedChange={setOrbCollapsed} term={{id:term.id,title:term.title.en,definition:explanation.definition,example:explanation.example}} /> : undefined} footer={explanation ? <Button title={copied ? 'Copied' : 'Copy question'} icon="copy" onPress={() => { void copyDraft(t(explanation.question)).then(() => setCopied(true)).catch(() => setError('The question could not be copied. Try again.')); }} /> : undefined}>
    <Group gap={space.lg}><Txt variant="display">{term.title.en}</Txt><Txt muted>{term.id === 'eob' ? 'Often called an EOB' : 'A useful term to know'}</Txt></Group>
    {!explanation ? error ? <Feedback danger text={error} action={{ title: 'Try again', onPress: () => { setError(''); setRetry(v => v + 1); } }} /> : <FootnoteLoader compact title="Opening the explanation" detail="A definition and a useful example." /> : <>
      <Txt>{explanation.definition}</Txt>
      <Button title="Agent voice settings" variant="secondary" onPress={() => router.navigate('/voices')} />
      <Group gap={space.sm}><Choice title="Simple explanation" selected={depth === 'simple'} onPress={() => useFootnoteStore.getState().setExplanationDepth('simple')} /><Choice title="Show a more detailed explanation" selected={depth === 'detailed'} onPress={() => useFootnoteStore.getState().setExplanationDepth('detailed')} /></Group>
      <Card><Txt variant="section">For example</Txt><Txt>{explanation.example}</Txt></Card>
      <Section title="A question you can ask"><Txt>{explanation.question}</Txt></Section>
      <ButtonRow><Button title={saved ? 'Saved term' : 'Save term'} icon={saved ? 'check' : 'bookmark'} variant="quiet" onPress={() => useFootnoteStore.getState().toggleSavedTerm(termId)} /><Button title="Read the source" icon="export" variant="secondary" onPress={() => { void Linking.openURL(explanation.source.url).catch(() => setError('The source could not be opened. Try again when online.')); }} /></ButtonRow>
      <Txt variant="caption" muted>{explanation.source.title}. Definitions and examples come from the linked source.</Txt>
    </>}
    {explanation && error ? <Feedback danger onDismiss={() => setError('')} text={error} /> : null}
    <Txt variant="caption" muted>Your own plan documents determine your coverage.</Txt>
  </Screen>;
}
