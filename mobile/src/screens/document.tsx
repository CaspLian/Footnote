import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { DocumentKind } from '@/domain';
import { useUnfoldStore } from '@/store';
import { DocumentPreview } from '@/native';
import { Button, ButtonRow, Feedback, Screen, Txt, useLanguage } from '@/components/ui';
import { MissingCase, caseRoute, useCase } from './shared';
export function DocumentScreen() {
  const c=useCase();const {attachmentId}=useLocalSearchParams<{attachmentId:string}>();const {locale,copy}=useLanguage();const [failed,setFailed]=useState(false);if(!c)return <MissingCase/>;const attachment=c.attachments.find(a=>a.id===attachmentId);if(!attachment)return <Screen><Feedback text={copy('This attachment is unavailable. Import it again or enter the details manually.','Este archivo no está disponible. Impórtalo de nuevo o ingresa los datos manualmente.')} action={{title:copy('Add document','Agregar documento'),onPress:()=>caseRoute('/intake',c.id)}}/></Screen>;
  function classify(kind:DocumentKind){useUnfoldStore.getState().updateAttachment(c!.id,attachment!.id,kind);}
  return <Screen testID="document" footer={<Button title={copy('Done','Listo')} onPress={()=>router.back()}/>}><Txt variant="section">{copy('Document type','Tipo de documento')}</Txt><Button title="Auto (Recommended)" variant={attachment.kind==='auto'?'primary':'secondary'} onPress={()=>classify('auto')}/><ButtonRow>{(['bill','eob','policy'] as DocumentKind[]).map(kind=><Button key={kind} style={{flexGrow:1}} title={kind==='bill'?copy('Bill','Factura'):kind==='eob'?'EOB':copy('Policy','Póliza')} variant={kind===attachment.kind?'primary':'secondary'} onPress={()=>classify(kind)}/>)}</ButtonRow><DocumentPreview attachment={attachment} language={locale} onError={()=>setFailed(true)}/>{failed?<Button title={copy('Add a different document','Agregar otro documento')} variant="secondary" onPress={()=>caseRoute('/intake',c.id)}/>:null}<Button title={copy('Enter or verify details','Ingresar o verificar datos')} material="glass" variant="secondary" onPress={()=>caseRoute('/verify',c.id)}/><Txt variant="caption" muted>{copy('Auto is saved as your classification preference. AI classification is not connected yet; choose a type or enter the details manually.','La clasificación etiqueta el documento; no extrae ni valida su contenido.')}</Txt></Screen>;
}
