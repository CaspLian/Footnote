import { DocumentImportError, DocumentImportProgress, useDocumentImport } from '@/components/document-import';
import { useState } from 'react';
import { router } from 'expo-router';
import { useFootnoteStore } from '@/store';
import { Button, Feedback, Group, IconButton, Screen, Txt } from '@/components/ui';
import { Icon } from '@/components/icon';
import { confirmAction } from '@/components/confirm';
import { space, useTheme } from '@/theme';
import { MissingCase, useCase } from './shared';
import { View } from 'react-native';

export function ConfirmDocuments() {
  const c = useCase(); const importFlow = useDocumentImport();
  const { colors } = useTheme();
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  if (!c) return <MissingCase />;
  return <Screen searchMode={true} blockingOverlay={<DocumentImportProgress flow={importFlow}/>} testID="confirm-documents" footer={<Button title={c.attachments.length === 1 ? 'Use this document' : 'Use these documents'} disabled={!c.attachments.length || removing || importFlow.busy} onPress={() => router.push({ pathname: '/understanding', params: { caseId: c.id } })} />}>
    <DocumentImportError flow={importFlow}/>
    <Group gap={space.xs}>
      <Txt variant="title">Confirm documents</Txt>
      <Txt muted>{c.attachments.length ? `${c.attachments.length} ${c.attachments.length === 1 ? 'document' : 'documents'} ready to review` : 'Add a document to continue'}</Txt>
    </Group>
    {c.attachments.length ? <View style={{ gap: space.sm }}>
      {c.attachments.map((a, index) => <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, padding: space.md, gap: space.md, borderWidth: 1, borderColor: colors.line }}>
        <Icon name={a.mimeType === 'application/pdf' ? 'pdf' : 'images'} size={24} feature />
        <Group style={{ flex: 1 }} gap={2}>
          <Txt variant="item" numberOfLines={1} translate={false}>{a.name}</Txt>
          <Txt variant="caption" muted>{a.kind === 'auto' ? 'Auto-detect' : a.kind === 'bill' ? 'Medical bill' : a.kind === 'eob' ? 'EOB' : 'Plan document'} · #{index + 1}</Txt>
        </Group>
        <Button compact title="Preview" variant="quiet" onPress={() => router.push({ pathname: '/document', params: { caseId: c.id, attachmentId: a.id } })} />
        <IconButton label="Remove document" name="trash" disabled={removing} onPress={() => confirmAction('Remove this document?', 'The private copy will be removed from this case.', 'Remove document', () => { setRemoving(true); void useFootnoteStore.getState().removeAttachment(c.id, a.id).catch(() => setError('This document could not be removed. Try again.')).finally(() => setRemoving(false)); }, true)} />
      </View>)}
    </View> : <Feedback text="No documents are attached. Add a photo or PDF to continue." />}
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <Button compact title="Take another photo" icon="camera" variant="secondary" disabled={importFlow.busy} onPress={() => { void importFlow.run('camera', 'auto', c.id); }} style={{ flex: 1 }} />
      <Button compact title="Add documents" icon="plus" variant="secondary" disabled={importFlow.busy} onPress={() => router.navigate({ pathname: '/intake', params: { caseId: c.id } })} style={{ flex: 1 }} />
    </View>
    {error ? <Feedback danger text={error} /> : null}
  </Screen>;
}
