import { Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { backendConfigured } from '@/services';
import { useFootnoteStore } from '@/store';
import { DocumentImportError, DocumentImportProgress, useDocumentImport } from '@/components/document-import';
import { Button, Card, Group, Screen, Txt, useLanguage } from '@/components/ui';
import { GlassSurface, useGlassAvailable } from '@/components/glass-surface';
import { Icon, IconName } from '@/components/icon';
import { useTheme, space, radius, shadows } from '@/theme';
import { caseRoute } from './shared';


function ImportAction({title,detail,icon,prominent=false,disabled,onPress}:{title:string;detail:string;icon:IconName;prominent?:boolean;disabled:boolean;onPress:()=>void}) {
  const {colors,reducedMotion}=useTheme();const nativeGlass=useGlassAvailable();const haptics=useFootnoteStore(s=>s.preferences.haptics);
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={detail} accessibilityState={{disabled}} disabled={disabled} onPress={()=>{if(Platform.OS!=='web'&&haptics)void Haptics.selectionAsync().catch(()=>{});onPress();}} style={({pressed})=>({flex:prominent?undefined:1,minWidth:0,minHeight:prominent?96:140,padding:space.lg,borderRadius:radius.card,borderCurve:'continuous',flexDirection:prominent?'row':'column',alignItems:prominent?'center':'flex-start',gap:space.md,boxShadow:nativeGlass?'none':shadows.paper,opacity:disabled?.45:pressed?.85:1,transform:[{scale:pressed&&!reducedMotion?.98:1}]})}>
    <GlassSurface tinted={prominent} style={[StyleSheet.absoluteFill,{borderRadius:radius.card}]}/>
    <View style={{width:40,height:40,justifyContent:'center',alignItems:'center'}}><Icon name={icon} size={28} feature color={colors.accent}/></View>
    <Group gap={space.xs} style={{flex:prominent?1:undefined}}><Txt variant="item" accent={prominent}>{title}</Txt><Txt variant="caption" muted>{detail}</Txt></Group>
    {prominent?<Icon name="next" size={20} color={colors.accent}/>:null}
  </Pressable>;
}

export function Intake() {
  const {copy}=useLanguage();const params=useLocalSearchParams<{caseId?:string}>();const importFlow=useDocumentImport();const busy=importFlow.busy;
  const profile=useFootnoteStore(s=>s.profiles.find(p=>p.id===s.activeProfileId));
  const cases=useFootnoteStore(s=>s.cases);const targetId=params.caseId; const current=cases.find(c=>c.id===targetId);
  // Native camera pages use the in-app multi-page capture (screens/camera.tsx); it commits like importFlow and opens /confirm-documents.
  function pick(source:'camera'|'photos'|'files') { if(source==='camera'&&Platform.OS!=='web'){router.push({pathname:'/camera',params:{caseId:targetId,kind:'auto'}} as unknown as Href);return;} void importFlow.run(source,'auto',targetId); }
  function manual(){const id=useFootnoteStore.getState().addManualCase();caseRoute('/verify',id);}
  return <Screen blockingOverlay={<DocumentImportProgress flow={importFlow}/>} testID="intake" footerHint={current ? `${current.attachments.length} documents ready to confirm` : undefined} footer={<Button title={current?copy('Confirm documents','Confirmar documentos'):copy('Enter details manually','Ingresar datos manualmente')} disabled={busy} onPress={()=>current?router.push({pathname:'/confirm-documents',params:{caseId:current.id}}):manual()}/>}><DocumentImportError flow={importFlow}/><Group><Txt variant="display">{copy('Add your documents','Empieza con lo que tienes.')}</Txt><Txt muted>{copy('Add a bill, an EOB, or both. We’ll use the evidence you have, and you can add more later.','Una factura detallada y la EOB ofrecen la imagen más clara. Puedes agregar el otro documento después.')}</Txt></Group>
    <Button title={`For ${profile?.firstName??'yourself'} · Change profile`} variant="quiet" icon="profile" disabled={busy} onPress={()=>router.push({pathname:'/profiles',params:{choose:'1',caseId:current?.id}})}/>
    <Group gap={space.md}>
      <ImportAction title="Take a photo" detail="Capture a clear bill or EOB." icon="camera" prominent disabled={busy} onPress={()=>pick('camera')}/>
      <View style={{flexDirection:'row',gap:space.md}}>
        <ImportAction title="Choose photos" detail="Use a saved image." icon="images" disabled={busy} onPress={()=>pick('photos')}/>
        <ImportAction title="Choose a PDF" detail="From Files or downloads." icon="pdf" disabled={busy} onPress={()=>pick('files')}/>
      </View>
    </Group>
    {current?<Group><Txt variant="section">{copy('Your documents','Tus documentos')}</Txt>{current.attachments.map(a=><Card key={a.id}><Txt translate={false}>{a.name}</Txt><Txt variant="caption" muted>{a.kind==='auto'?'Auto · awaiting classification':a.kind==='bill'?copy('Bill','Factura'):a.kind==='eob'?'EOB':copy('Policy','Póliza')}</Txt><Button title={copy('Preview document','Ver documento')} variant="secondary" onPress={()=>router.push({pathname:'/document',params:{caseId:current.id,attachmentId:a.id}})}/></Card>)}</Group>:null}
    <Txt variant="caption" muted>{backendConfigured()?copy('Photos and PDFs are sent to your configured backend for extraction, then shown for you to verify.','Las fotos y los PDF se envían al backend configurado para extraer los datos y luego verificarlos.'):copy('No backend is set, so imported documents are reviewed manually.','No hay un backend configurado, así que los documentos importados se revisan manualmente.')}</Txt>
  </Screen>;
}
