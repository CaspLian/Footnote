import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { DocumentKind } from '@/domain';
import { useUnfoldStore } from '@/store';
import { DocumentImportError, DocumentImportProgress, useDocumentImport } from '@/components/document-import';
import { Button, Card, Choice, Feedback, Group, Screen, Txt, useLanguage } from '@/components/ui';
import { GlassSurface, useGlassAvailable } from '@/components/glass-surface';
import { AppSheet } from '@/components/sheet';
import { Icon, IconName } from '@/components/icon';
import { useTheme, space, radius, shadows } from '@/theme';
import { caseRoute } from './shared';


function ImportAction({title,detail,icon,prominent=false,disabled,onPress}:{title:string;detail:string;icon:IconName;prominent?:boolean;disabled:boolean;onPress:()=>void}) {
  const {colors,reducedMotion}=useTheme();const nativeGlass=useGlassAvailable();const haptics=useUnfoldStore(s=>s.preferences.haptics);
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={detail} accessibilityState={{disabled}} disabled={disabled} onPress={()=>{if(Platform.OS!=='web'&&haptics)void Haptics.selectionAsync().catch(()=>{});onPress();}} style={({pressed})=>({flex:prominent?undefined:1,minWidth:0,minHeight:prominent?96:140,padding:space.lg,borderRadius:radius.card,borderCurve:'continuous',flexDirection:prominent?'row':'column',alignItems:prominent?'center':'flex-start',gap:space.md,boxShadow:nativeGlass?'none':shadows.paper,opacity:disabled?.45:pressed?.85:1,transform:[{scale:pressed&&!reducedMotion?.98:1}]})}>
    <GlassSurface tinted={prominent} style={[StyleSheet.absoluteFill,{borderRadius:radius.card}]}/>
    <View style={{width:40,height:40,justifyContent:'center',alignItems:'center'}}><Icon name={icon} size={28} feature color={colors.accent}/></View>
    <Group gap={space.xs} style={{flex:prominent?1:undefined}}><Txt variant="item" accent={prominent}>{title}</Txt><Txt variant="caption" muted>{detail}</Txt></Group>
    {prominent?<Icon name="next" size={20} color={colors.accent}/>:null}
  </Pressable>;
}

const kindTitles: Record<DocumentKind, string> = { auto: 'Auto (Recommended)', bill: 'Bill', eob: 'Explanation of benefits', policy: 'Policy' };
export function Intake() {
  const {copy}=useLanguage();const params=useLocalSearchParams<{caseId?:string}>();const [caseId,setCaseId]=useState<string|undefined>(undefined);const [kind,setKind]=useState<DocumentKind>('auto');const [sampleBusy,setSampleBusy]=useState(false);const [feedback,setFeedback]=useState('');const importFlow=useDocumentImport();const busy=sampleBusy||importFlow.busy;
  const profile=useUnfoldStore(s=>s.profiles.find(p=>p.id===s.activeProfileId));
  const [typeSheet, setTypeSheet] = useState(false);
  const cases=useUnfoldStore(s=>s.cases);const targetId=caseId ?? params.caseId; const current=cases.find(c=>c.id===targetId);
  function pick(source:'camera'|'photos'|'files') { setFeedback(''); void importFlow.run(source,kind,targetId); }
  async function sample(){setSampleBusy(true);setFeedback('');try{const id=await useUnfoldStore.getState().loadSample();setCaseId(id);}catch{setFeedback(copy('The sample could not be loaded. Try again.','No se pudo cargar el ejemplo. Intenta de nuevo.'));}finally{setSampleBusy(false);}}
  function manual(){const id=useUnfoldStore.getState().addManualCase();caseRoute('/verify',id);}
  return <Screen testID="intake" footerHint={current ? `${current.attachments.length} documents ready to confirm` : undefined} footer={<Button title={current?copy('Confirm documents','Confirmar documentos'):copy('Enter details manually','Ingresar datos manualmente')} disabled={busy} onPress={()=>current?router.push({pathname:'/confirm-documents',params:{caseId:current.id}}):manual()}/>}><DocumentImportProgress flow={importFlow}/><DocumentImportError flow={importFlow}/><Group><Txt variant="display">{copy('Start with what you have.','Empieza con lo que tienes.')}</Txt><Txt muted>{copy('Add a bill, an EOB, or both. We’ll use the evidence you have, and you can add more later.','Una factura detallada y la EOB ofrecen la imagen más clara. Puedes agregar el otro documento después.')}</Txt></Group>
    <Button title={`For ${profile?.firstName??'yourself'} · Change profile`} variant="quiet" icon="profile" disabled={busy} onPress={()=>router.push({pathname:'/profiles',params:{choose:'1',caseId:current?.id}})}/>
    <Group gap={space.md}>
      <ImportAction title="Take a photo" detail="Capture a clear bill or EOB." icon="camera" prominent disabled={busy} onPress={()=>pick('camera')}/>
      <View style={{flexDirection:'row',gap:space.md}}>
        <ImportAction title="Choose photos" detail="Use a saved image." icon="images" disabled={busy} onPress={()=>pick('photos')}/>
        <ImportAction title="Choose a PDF" detail="From Files or downloads." icon="pdf" disabled={busy} onPress={()=>pick('files')}/>
      </View>
    </Group>
    <Group gap={space.sm}>
      <Txt variant="label" muted>Document type</Txt>
      <Button title={kindTitles[kind]} variant="secondary" icon={kind==='auto'?'files':kind==='bill'?'document':kind==='eob'?'book':'files'} disabled={busy} onPress={()=>setTypeSheet(true)}/>
      <Txt variant="caption" muted>{kind==='auto'?'Applies to your next import. AI classification will be available when connected.':'Applies to your next import. You can change the type after adding it.'}</Txt>
    </Group>
    <AppSheet visible={typeSheet} title="Document type" onClose={()=>setTypeSheet(false)}>
      <Txt muted>Choose how to label your next document. Auto is recommended for the future AI classification flow.</Txt>
      {(['auto','bill','eob','policy'] as DocumentKind[]).map(k=><Choice key={k} title={kindTitles[k]} detail={k==='auto'?'Let AI identify the document when connected.':k==='bill'?'A provider’s statement or itemized charges.':k==='eob'?'Your insurer’s explanation of how a claim was processed.':'Coverage details from your health plan.'} selected={kind===k} onPress={()=>{setKind(k);setTypeSheet(false);}}/>)}
    </AppSheet>
    {sampleBusy?<Feedback text={copy('Opening the sample…','Abriendo el ejemplo…')}/>:null}{feedback?<Feedback danger text={feedback}/>:null}
    {current?<Group><Txt variant="section">{copy('Your documents','Tus documentos')}</Txt>{current.attachments.map(a=><Card key={a.id}><Txt>{a.name}</Txt><Txt variant="caption" muted>{a.kind==='auto'?'Auto · awaiting classification':a.kind==='bill'?copy('Bill','Factura'):a.kind==='eob'?'EOB':copy('Policy','Póliza')}{a.origin==='sample'?copy(' · Synthetic sample',' · Ejemplo ficticio'):''}</Txt><Button title={copy('Preview document','Ver documento')} variant="secondary" onPress={()=>router.push({pathname:'/document',params:{caseId:current.id,attachmentId:a.id}})}/></Card>)}</Group>:null}
    <Txt variant="caption" muted>{copy('Imported documents are reviewed manually in this prototype.','Los documentos importados se revisan manualmente en este prototipo.')}</Txt><Button variant="quiet" title={copy('Use sample bill + EOB','Usar factura y EOB de ejemplo')} loading={busy} onPress={()=>void sample()}/>
  </Screen>;
}
