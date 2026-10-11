import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { router } from 'expo-router';
import { useFootnoteStore } from '@/store';
import { UnderstandingController, understandingService } from '@/services/document-understanding';
import { FootnoteLoader } from '@/components/loader';
import { Button, Feedback, Group, Screen, Txt } from '@/components/ui';
import { Icon } from '@/components/icon';
import { languageOption } from '@/domain/languages';
import { backendConfigured } from '@/services/backend';
import { space, useTheme } from '@/theme';
import { MissingCase, useCase } from './shared';

export function Understanding() {
  const c = useCase(); const { colors } = useTheme();
  const controller = useMemo(() => new UnderstandingController(understandingService), []);
  const progress = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [saveError, setSaveError] = useState('');
  const caseId = c?.id;
  function start() {
    if (!caseId) return;
    const store = useFootnoteStore.getState(); const current = store.cases.find(item => item.id === caseId);
    if (!current) return;
    void controller.run({ caseId, attachments: current.attachments, workingLanguage: store.preferences.workingLanguage, profile: store.profiles.find(p => p.id === current.profileId), personalContext: store.personalContext, savedAnalysisId: current.evidenceContextId ?? current.extraction?.auditId, dateRecoveryAttempted: current.dateRecoveryAttempted });
  }
  useEffect(() => { if (!caseId) return; const frame = requestAnimationFrame(start); return () => { cancelAnimationFrame(frame); controller.cancel(); }; // A fresh request is owned by this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, controller]);
  if (!c) return <MissingCase />;
  const done = progress.status === 'complete'; const manual = progress.result?.mode === 'manual'; const failed = progress.status === 'error';
  function proceed() {
    try { if (progress.result) useFootnoteStore.getState().applyUnderstandingResult(c!.id, progress.result); router.replace({ pathname: '/verify', params: { caseId: c!.id } }); } catch { setSaveError('The returned details couldn’t be saved. Your documents are safe. Try again or enter details manually.'); }
  }
  return <Screen contentWidth={600} testID="understanding" footer={done ? <Button title={manual ? 'Enter details manually' : 'Check the details'} onPress={proceed} /> : failed ? <Group><Button title="Try again" onPress={start} /><Button title="Enter details manually" variant="secondary" onPress={() => router.replace({ pathname: '/verify', params: { caseId: c.id } })} /></Group> : <Button title="Cancel and return to documents" variant="secondary" onPress={() => { controller.cancel(); router.back(); }} />}>
    <FootnoteLoader settled={done || failed} title={manual ? 'Your documents are saved.' : done ? 'Your details are ready to check.' : failed ? 'Let’s try that again.' : 'Understanding your documents'} detail={manual ? 'Automatic document review isn’t connected in this build. You can still continue with your own details.' : done ? 'Check what the documents say before reviewing the available evidence.' : failed ? 'Your private copies are still here.' : 'Finding the important details, so you can focus on what comes next.'} />
    {manual ? <Group gap={space.sm}><Txt variant="label" accent>Private copies saved</Txt><Txt muted>Ready for you to enter the details from your documents.</Txt></Group> : <Group gap={space.screen}>{[['reading', 'Reading the documents you confirmed'], ['organizing', 'Organizing amounts and source evidence']].map(([phase, title], index) => <Group key={phase} style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}><Icon name={done || progress.phase === 'organizing' && index === 0 ? 'check' : 'document'} color={done || index === 0 || progress.phase === phase ? colors.accent : colors.muted} /><Txt variant="label" muted={!done && index === 1 && progress.phase !== phase} style={{ flex: 1 }}>{title}</Txt></Group>)}</Group>}
    <Txt variant="caption" muted>{c.attachments.length} {c.attachments.length === 1 ? 'document' : 'documents'} · {languageOption(useFootnoteStore.getState().preferences.workingLanguage).native}. A bill and EOB are useful together, but neither is required as a pair. Additional evidence can be added later.</Txt>
    {backendConfigured() ? <Txt variant="caption" muted>Your confirmed documents are sent to your Footnote backend, which reads them with Gemini and saves the analysis. Your profile is not sent.</Txt> : null}
    {progress.error || saveError ? <Feedback danger text={saveError || progress.error!} /> : null}
  </Screen>;
}
