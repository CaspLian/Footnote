import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { router } from 'expo-router';
import { useFootnoteStore } from '@/store';
import { UnderstandingController, understandingService } from '@/services/document-understanding';
import { FootnoteLoader } from '@/components/loader';
import { Button, Feedback, Group, Screen, Txt } from '@/components/ui';
import { Icon } from '@/components/icon';
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
  if (failed) return <Screen contentWidth={600} testID="understanding-error" footer={<Group><Button title="Try again" icon="next" onPress={start} /><Button title="Choose a clearer document" icon="plus" variant="secondary" onPress={() => router.replace({ pathname: '/intake', params: { caseId: c.id } })} /><Button title="Enter details manually" variant="quiet" onPress={() => router.replace({ pathname: '/verify', params: { caseId: c.id } })} /></Group>}>
    <Group gap={space.xl} style={{ paddingTop: space.xxl }}><Icon name="document" feature size={64} color={colors.accent} /><Txt variant="display">{progress.errorCode === 'no_details' ? 'No bill details found' : 'We couldn’t read your documents.'}</Txt><Txt muted>{progress.errorCode === 'no_details' ? 'There weren’t enough readable bill amounts or services to start a review. Your documents are saved.' : 'Your documents are saved. You can retry or add a clearer copy.'}</Txt></Group>
    <Group gap={space.lg}><Txt variant="heading">Try a clearer document</Txt><Txt>Include the full page, keep the text in focus, and avoid glare. A bill, an EOB, or both can work.</Txt></Group>
    {progress.errorCode !== 'no_details' ? <Txt variant="caption" muted>{progress.error}</Txt> : null}
    <Button title="Back to your documents" variant="secondary" onPress={() => router.replace({ pathname: '/confirm-documents', params: { caseId: c.id } })} />
  </Screen>;
  return <Screen contentWidth={600} testID="understanding" footer={done ? <Button title={manual ? 'Enter details manually' : 'Check the details'} onPress={proceed} /> : failed ? <Group><Button title="Try again" onPress={start} /><Button title="Enter details manually" variant="secondary" onPress={() => router.replace({ pathname: '/verify', params: { caseId: c.id } })} /></Group> : <Button title="Cancel and return to documents" variant="secondary" onPress={() => { controller.cancel(); router.back(); }} />}>
    <FootnoteLoader settled={done || failed} title={manual ? 'Your documents are saved.' : done ? 'Document details ready' : failed ? 'Unable to read the documents' : 'Understanding your documents'} detail={manual ? 'Automatic document review isn’t connected in this build. You can still continue with your own details.' : done ? 'Check what the documents say before reviewing the available evidence.' : failed ? 'Your private copies are still here.' : 'Reading amounts, dates and services from your documents.'} />
    {manual ? <Group gap={space.sm}><Txt variant="label" accent>Private copies saved</Txt><Txt muted>Ready for you to enter the details from your documents.</Txt></Group> : <Group gap={space.screen}>{[['reading', 'Reading the documents you confirmed'], ['organizing', 'Organizing amounts and source evidence']].map(([phase, title], index) => <Group key={phase} style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}><Icon name={done || progress.phase === 'organizing' && index === 0 ? 'check' : 'document'} color={done || index === 0 || progress.phase === phase ? colors.accent : colors.muted} /><Txt variant="label" muted={!done && index === 1 && progress.phase !== phase} style={{ flex: 1 }}>{title}</Txt></Group>)}</Group>}
    {progress.error || saveError ? <Feedback danger text={saveError || progress.error!} /> : null}
  </Screen>;
}
