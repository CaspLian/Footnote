import { useState } from 'react';
import { Linking, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { DocumentKind } from '@/domain';
import { useUnfoldStore } from '@/store';
import { importDocument, nativeErrorMessage } from '@/native';
import { Button, Card, Choice, Divider, Feedback, Group, Screen, Txt, useLanguage } from '@/components/ui';
import { Icon, IconName } from '@/components/icon';
import { colors, space } from '@/theme';
import { caseRoute } from './shared';

export function Intake() {
  const {locale,copy}=useLanguage();const params=useLocalSearchParams<{caseId?:string}>();const [caseId,setCaseId]=useState<string|undefined>(undefined);const [kind,setKind]=useState<DocumentKind>('bill');const [busy,setBusy]=useState(false);const [feedback,setFeedback]=useState('');const [denied,setDenied]=useState(false);
  const profile=useUnfoldStore(s=>s.profiles.find(p=>p.id===s.activeProfileId));
  const cases=useUnfoldStore(s=>s.cases);const targetId=caseId ?? params.caseId; const current=cases.find(c=>c.id===targetId);
  async function pick(source:'camera'|'photos'|'files') {setBusy(true);setDenied(false);setFeedback('');try{const result=await importDocument(source,kind);if(result.status==='success'){if(targetId){useUnfoldStore.getState().addAttachment(targetId,result.attachment);}else{setCaseId(useUnfoldStore.getState().addImportedCase(result.attachment));}}else if(result.status==='permission-denied'){setDenied(true);setFeedback(copy('Access is off. You can choose a different source or open device settings.','El acceso está desactivado. Elige otra fuente o abre los ajustes del dispositivo.'));}else if(result.status==='error'){setFeedback(nativeErrorMessage(result,locale));}}catch{setFeedback(copy('The document could not be added. Try another source.','No se pudo agregar el documento. Prueba otra fuente.'));}finally{setBusy(false);} }
  async function sample(){setBusy(true);setFeedback('');try{const id=await useUnfoldStore.getState().loadSample();setCaseId(id);}catch{setFeedback(copy('The sample could not be loaded. Try again.','No se pudo cargar el ejemplo. Intenta de nuevo.'));}finally{setBusy(false);}}
  function manual(){const id=useUnfoldStore.getState().addManualCase();caseRoute('/verify',id);}
  return <Screen testID="intake" footer={<Button title={current?copy('Verify details','Verificar datos'):copy('Enter details manually','Ingresar datos manualmente')} disabled={busy} onPress={()=>current?caseRoute('/verify',current.id):manual()}/>}><Group><Txt variant="display">{copy('Start with what you have.','Empieza con lo que tienes.')}</Txt><Txt muted>{copy('An itemized bill and EOB give you the clearest picture. You can add the other document later.','Una factura detallada y la EOB ofrecen la imagen más clara. Puedes agregar el otro documento después.')}</Txt></Group>
    <Button title={`For ${profile?.firstName??'yourself'} · Change profile`} variant="quiet" icon="profile" onPress={()=>router.push({pathname:'/profiles',params:{choose:'1',caseId:current?.id}})}/><Group gap={space.xs}>{(['bill','eob','policy'] as DocumentKind[]).map(k=><Choice key={k} title={k==='bill'?copy('Bill','Factura'):k==='eob'?'EOB':copy('Policy','Póliza')} selected={kind===k} onPress={()=>setKind(k)} />)}</Group>
    {([['camera',copy('Take a photo','Tomar una foto'),'camera'],['photos',copy('Choose photos','Elegir fotos'),'images'],['files',copy('Choose a PDF','Elegir un PDF'),'pdf']] as [ 'camera'|'photos'|'files',string,IconName][]).map(([source,label,ic])=><Pressable key={source} accessibilityRole="button" accessibilityLabel={label} disabled={busy} accessibilityState={{disabled:busy}} onPress={()=>void pick(source)} style={({pressed})=>({opacity:busy?.45:pressed?.7:1})}><Group gap={space.lg} style={{paddingVertical:space.lg}}><Group style={{flexDirection:'row',alignItems:'center'}}><Icon name={ic} color={colors.accent}/><Txt>{label}</Txt></Group><Divider/></Group></Pressable>)}
    {busy?<Feedback text={copy('Adding your document…','Agregando tu documento…')}/>:null}{feedback?<Feedback danger text={feedback} action={denied?{title:copy('Open device settings','Abrir ajustes del dispositivo'),onPress:()=>{void Linking.openSettings();}}:undefined}/>:null}
    {current?<Group><Txt variant="section">{copy('Your documents','Tus documentos')}</Txt>{current.attachments.map(a=><Card key={a.id}><Txt>{a.name}</Txt><Txt variant="caption" muted>{a.kind==='bill'?copy('Bill','Factura'):a.kind==='eob'?'EOB':copy('Policy','Póliza')}{a.origin==='sample'?copy(' · Synthetic sample',' · Ejemplo ficticio'):''}</Txt><Button title={copy('Preview document','Ver documento')} variant="secondary" onPress={()=>router.push({pathname:'/document',params:{caseId:current.id,attachmentId:a.id}})}/></Card>)}</Group>:null}
    <Txt variant="caption" muted>{copy('Imported documents are reviewed manually in this prototype.','Los documentos importados se revisan manualmente en este prototipo.')}</Txt><Button variant="quiet" title={copy('Use sample bill + EOB','Usar factura y EOB de ejemplo')} loading={busy} onPress={()=>void sample()}/>
  </Screen>;
}
