import { DocumentImportError, DocumentImportProgress, useDocumentImport } from '@/components/document-import';
import { useState } from 'react';
import { router } from 'expo-router';
import { useFootnoteStore } from '@/store';
import { Badge, Button, ButtonRow, Card, Feedback, Group, Screen, Txt } from '@/components/ui';
import { Icon } from '@/components/icon';
import { confirmAction } from '@/components/confirm';
import { space } from '@/theme';
import { MissingCase, useCase } from './shared';

export function ConfirmDocuments() {
  const c = useCase(); const importFlow = useDocumentImport();
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  if (!c) return <MissingCase />;
  return <Screen blockingOverlay={<DocumentImportProgress flow={importFlow}/>} testID="confirm-documents" footer={<Button title={`Use ${c.attachments.length === 1 ? 'this document' : 'these documents'}`} disabled={!c.attachments.length || removing || importFlow.busy} onPress={() => router.push({ pathname: '/understanding', params: { caseId: c.id } })} />}>
    <DocumentImportError flow={importFlow}/><Group gap={space.lg}><Txt variant="display">Confirm your documents</Txt><Txt muted>Confirm what you’ve added. A bill, an EOB, or both · start with whatever you have.</Txt></Group>
    <Badge text={`${c.attachments.length} ${c.attachments.length === 1 ? 'document' : 'documents'} added`} tone="accent" />
    {c.attachments.length ? c.attachments.map((a, index) => <Card key={a.id}>
      <Group style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}><Icon name={a.mimeType === 'application/pdf' ? 'pdf' : 'images'} size={28} feature /><Group style={{ flex: 1 }}><Txt variant="item" numberOfLines={2} translate={false}>{a.name}</Txt><Txt variant="caption" muted>{a.kind === 'auto' ? 'Auto · identify from the document' : a.kind === 'bill' ? 'Medical bill' : a.kind === 'eob' ? 'Explanation of benefits' : 'Plan document'} · {index + 1} of {c.attachments.length}</Txt></Group></Group>
      <ButtonRow><Button title="Preview" icon="document" variant="secondary" onPress={() => router.push({ pathname: '/document', params: { caseId: c.id, attachmentId: a.id } })} /><Button title="Remove" icon="trash" variant="quiet" disabled={removing} onPress={() => confirmAction('Remove this document?', 'The private copy will be removed from this case.', 'Remove document', () => { setRemoving(true); void useFootnoteStore.getState().removeAttachment(c.id, a.id).catch(() => setError('This document could not be removed. Try again.')).finally(() => setRemoving(false)); }, true)} /></ButtonRow>
    </Card>) : <Feedback text="No documents are attached. Add a photo or PDF to continue." />}
    <ButtonRow><Button title="Take another photo" icon="camera" variant="secondary" disabled={importFlow.busy} onPress={()=>{void importFlow.run('camera','auto',c.id);}}/><Button title="Add documents" icon="plus" variant="secondary" disabled={importFlow.busy} onPress={() => router.navigate({ pathname: '/intake', params: { caseId: c.id } })} /></ButtonRow>
    <Txt variant="caption" muted>We’ll organize the details first. The review can then use all available evidence, including sourced comparisons when they’re connected.</Txt>
    {error ? <Feedback danger text={error} /> : null}
  </Screen>;
}
