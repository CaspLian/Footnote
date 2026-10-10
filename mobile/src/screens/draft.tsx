import { useEffect, useState } from 'react';
import { Platform, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { confirmAction } from '@/components/confirm';
import { UnfoldLoader } from '@/components/loader';
import { DraftKind } from '@/domain';
import { useUnfoldStore } from '@/store';
import { copyDraft, exportDraftPdf, nativeErrorMessage, shareDocument } from '@/native';
import { Button, ButtonRow, Choice, Feedback, Group, Screen, Txt, useUIStyles, useDesktop, useLanguage } from '@/components/ui';
import { useTheme, type, space } from '@/theme';
import { MissingCase, caseRoute, useCase } from './shared';

export function DraftWorkspace() { const { colors } = useTheme(); const styles = useUIStyles();
  const c = useCase();
  const desktop = useDesktop();
  const { locale, copy } = useLanguage();
  const params = useLocalSearchParams<{ kind?: DraftKind }>();
  const [kind, setKind] = useState<DraftKind>(params.kind === 'insurer_appeal' ? 'insurer_appeal' : 'billing_correction');
  const drafts = useUnfoldStore(s => s.drafts);
  const storageError = useUnfoldStore(s => s.storageError);
  const draft = drafts.find(d => d.caseId === c?.id && d.kind === kind && d.locale === locale);
  const body = draft?.body ?? '';
  const [preparedHere, setPreparedHere] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const loading = !draft && !error;
  const recovered = !!draft && !preparedHere;
  const caseId = c?.id;

  useEffect(() => {
    let active = true;
    if (!caseId) return;
    const current = useUnfoldStore.getState().drafts.find(d => d.caseId === caseId && d.kind === kind && d.locale === locale);
    if (!current) void useUnfoldStore.getState().prepareDraft(caseId, kind)
      .then(() => { if (active) setPreparedHere(true); })
      .catch(() => { if (active) setError(copy('The draft could not be prepared. Try again.', 'No se pudo preparar el borrador. Intenta de nuevo.')); });
    return () => { active = false; };
  }, [caseId, kind, locale, copy]);
  if (!c) return <MissingCase />;

  function edit(text: string) {
    if (c) useUnfoldStore.getState().saveDraft(c.id, kind, text, locale);
    setMessage('');
  }
  async function run(action: 'copy' | 'pdf') {
    setBusy(true); setError(''); setMessage('');
    try {
      if (action === 'copy') {
        await copyDraft(body);
        setMessage('Copied to your clipboard.');
      } else {
        const { uri } = await exportDraftPdf({ title: kind === 'billing_correction' ? 'Billing correction request' : 'Insurer review request', body, language: locale });
        const result = await shareDocument(uri);
        setMessage(result === 'unavailable' ? 'Sharing is unavailable. You can copy this draft instead.' : Platform.OS === 'web' ? 'Print dialog opened. Choose Save as PDF. Nothing is sent.' : 'PDF created. Closing the share sheet does not mark this request submitted.');
      }
    } catch (e) { setError(nativeErrorMessage(e, locale)); }
    finally { setBusy(false); }
  }
  function submitted() {
    if (!draft) return;
    confirmAction('Record this submission?', 'Confirm only after you sent the request yourself. Unfold does not send it.', 'Mark submitted', () => {
      useUnfoldStore.getState().markSubmitted(draft.id);
      caseRoute('/timeline', c!.id);
    });
  }
  const heading = <Group gap={space.lg}><Txt variant="display">Put your question{'\n'}into words.</Txt><Txt muted>A saved draft. You choose when to send it.</Txt></Group>;
  const choices = <Group gap={space.md}>
    <Choice title="Billing correction" detail="Ask the provider to clarify or correct your bill." selected={kind === 'billing_correction'} onPress={() => { setKind('billing_correction'); setError(''); setMessage(''); }} />
    <Choice title="Insurer review / appeal" detail="Ask your health plan to review a coverage decision." selected={kind === 'insurer_appeal'} onPress={() => { setKind('insurer_appeal'); setError(''); setMessage(''); }} />
  </Group>;
  const utilities = <Group gap={space.lg}>
    <ButtonRow stack={desktop}>
      <Button icon="copy" variant="secondary" title="Copy" disabled={busy || loading || !body.trim()} onPress={() => void run('copy')} />
      <Button icon="export" variant="secondary" title={Platform.OS === 'web' ? 'Print / save PDF' : 'Share PDF'} disabled={busy || loading || !body.trim()} onPress={() => void run('pdf')} />
    </ButtonRow>
    <Button title="Open call script" variant="quiet" onPress={() => router.push({ pathname: '/call-script', params: { caseId: c.id, kind } })} />
    <Button title="Open timeline" variant="quiet" onPress={() => caseRoute('/timeline', c.id)} />
    <Txt variant="caption" muted>Mark submitted only after you send the request yourself.</Txt>
  </Group>;
  return <Screen testID="draft" asideWidth={320} aside={<Group gap={space.xl}>{heading}{choices}{utilities}</Group>} footerHint={loading ? 'Preparing your draft…' : storageError ? 'Saving needs attention' : draft ? 'Draft saved on this device' : undefined} footer={<Button title={draft?.submittedAt ? 'Open submission timeline' : 'Mark submitted'} disabled={loading || busy || !body.trim() || !!storageError} onPress={() => draft?.submittedAt ? caseRoute('/timeline', c.id) : submitted()} />}>
    {!desktop ? <>{heading}{choices}</> : <Group gap={space.sm}><Txt variant="section">Your draft</Txt><Txt muted>{c.provider}</Txt></Group>}
    {kind === 'insurer_appeal' ? <Feedback text="Identify the insurer decision and your reason for asking for review. The sample has no denial; this is an explanation request. Confirm any deadline from your plan documents." /> : null}
    {loading ? <UnfoldLoader compact title="Preparing your draft" detail="Turning your confirmed questions into words." /> : <TextInput testID="draft-body" accessibilityLabel="Editable request draft" value={body} onChangeText={edit} multiline scrollEnabled textAlignVertical="top" style={[type.body, styles.page, { color: colors.ink, height: desktop ? 640 : 420 }]} />}
    <Txt variant="caption" muted>{storageError ? 'Changes are in memory. Saving needs attention.' : recovered ? 'Your saved draft was restored on this device.' : 'Saved on this device'}</Txt>
    {!desktop ? utilities : null}
    {message ? <Feedback text={message} /> : null}
    {error ? <Feedback danger text={error} action={body.trim() ? undefined : { title: 'Try preparing again', onPress: () => { void useUnfoldStore.getState().prepareDraft(c.id, kind).then(() => { setError(''); setPreparedHere(true); }).catch(() => setError('Try preparing the draft again.')); } }} /> : null}
  </Screen>;
}
