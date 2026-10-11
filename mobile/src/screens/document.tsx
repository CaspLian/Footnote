import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { DocumentKind } from '@/domain';
import { needsDocumentProcessing } from '@/domain/document-readiness';
import { useFootnoteStore } from '@/store';
import { DocumentPreview } from '@/native';
import { Button, ButtonRow, Feedback, Screen, Txt, useLanguage } from '@/components/ui';
import { confirmAction } from '@/components/confirm';
import { MissingCase, caseRoute, useCase } from './shared';

export function DocumentScreen() {
  const c = useCase();
  const { attachmentId } = useLocalSearchParams<{ attachmentId: string }>();
  const { locale, copy } = useLanguage();
  const [failed, setFailed] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  if (!c) return <MissingCase />;
  const attachment = c.attachments.find(a => a.id === attachmentId);
  if (!attachment) return <Screen><Feedback text={copy('This attachment is unavailable. Import it again or enter the details manually.','')} action={{title:copy('Add document',''),onPress:()=>caseRoute('/intake',c.id)}}/></Screen>;
  const isAutoProcessed = Boolean(attachment.suggestedKind || (c.extraction && attachment.kind !== 'auto'));
  function classify(kind: DocumentKind) {
    if (isAutoProcessed) return;
    useFootnoteStore.getState().updateAttachment(c!.id, attachment!.id, kind);
  }
  function remove() {
    confirmAction('Remove this document?', 'The private copy will be removed from this case.', 'Remove document', () => {
      setRemoving(true);
      void useFootnoteStore.getState().removeAttachment(c!.id, attachment!.id)
        .then(() => { if (router.canGoBack()) router.back(); else caseRoute('/confirm-documents', c!.id); })
        .catch(() => setError('This document could not be removed. Try again.'))
        .finally(() => setRemoving(false));
    }, true);
  }
  return <Screen testID="document" footer={<Button title={copy('Done','')} disabled={removing} onPress={()=>router.back()}/>}>
    <Txt variant="section">{copy('Document type','')}</Txt>
    {!isAutoProcessed && attachment.kind === 'auto' ? <Button title="Auto (Recommended)" disabled={removing} variant="primary" onPress={()=>classify('auto')}/> : null}
    <ButtonRow>{(['bill','eob','policy'] as DocumentKind[]).map(kind=><Button key={kind} style={{flexGrow:1}} disabled={removing || isAutoProcessed} title={kind==='bill'?copy('Bill','Factura'):kind==='eob'?'EOB':copy('Policy','Póliza')} variant={kind===attachment.kind?'primary':'secondary'} onPress={()=>classify(kind)}/>)}</ButtonRow>
    <DocumentPreview attachment={attachment} language={locale} onError={()=>setFailed(true)}/>
    {failed?<Button title={copy('Add a different document','')} disabled={removing} variant="secondary" onPress={()=>caseRoute('/intake',c.id)}/>:null}
    {needsDocumentProcessing(c)?<Button title="Confirm documents" icon="document" disabled={removing} material="glass" variant="secondary" onPress={()=>caseRoute('/confirm-documents',c.id)}/>:<Button title={copy('Enter or verify details','')} disabled={removing} material="glass" variant="secondary" onPress={()=>caseRoute('/verify',c.id)}/>}
    <Button title="Remove document" icon="trash" variant="secondary" loading={removing} onPress={remove}/>
    {error?<Feedback danger text={error}/>:null}
    <Txt variant="caption" muted>{isAutoProcessed ? copy('Document type was identified during analysis and cannot be changed.', '') : attachment.kind === 'auto' ? copy('Auto leaves the type open for the document reading. Labels do not verify amounts or coverage.','') : copy('Labels identify document categories and do not verify amounts or coverage.','')}</Txt>
  </Screen>;
}
