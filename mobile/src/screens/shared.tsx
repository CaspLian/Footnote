import { useLocalSearchParams, router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useFootnoteStore } from '@/store';
import { BillCase, CaseStatus, formatDate, formatMoney } from '@/domain';
import { Badge, Button, Feedback, Group, Screen, Txt, useLanguage } from '@/components/ui';
import { CaseReminder } from '@/components/case-reminder';
import { Icon } from '@/components/icon';
import { useTheme, space, radius, shadows } from '@/theme';
import { needsDocumentProcessing } from '@/domain/document-readiness';

export function useCase() {
  const params = useLocalSearchParams<{ caseId?: string }>();
  const active = useFootnoteStore(s => s.activeCaseId);
  const cases = useFootnoteStore(s => s.cases);
  return cases.find(c => c.source === 'manual' && c.id === (params.caseId ?? active));
}
export function caseRoute(pathname: '/review'|'/verify'|'/timeline'|'/draft'|'/intake'|'/confirm-documents', id: string) { const c=useFootnoteStore.getState().cases.find(item=>item.id===id); useFootnoteStore.getState().setActiveCase(id); if ((pathname==='/verify'||pathname==='/review'||pathname==='/draft')&&c&&needsDocumentProcessing(c)) pathname='/confirm-documents'; if (pathname === '/timeline') router.navigate('/(tabs)/track'); else router.push({ pathname, params: { caseId: id } }); }
export function DocumentsNeedProcessing({billCase}:{billCase:BillCase}) { return <Screen testID="documents-awaiting-processing" footer={<Button title="Confirm documents" icon="document" onPress={()=>caseRoute('/confirm-documents',billCase.id)}/>}><Txt variant="title">Confirm your documents</Txt><Txt muted>We’ll organize the details first. The review can then use all available evidence, including sourced comparisons when they’re connected.</Txt></Screen>; }
export function MissingCase() { const { copy } = useLanguage(); return <Screen><Feedback title={copy('This case is unavailable.','Este caso no está disponible.')} text={copy('It may have been removed. Open Bills to choose a case.','Puede haberse eliminado. Abre Facturas para elegir un caso.')} action={{ title: copy('Open Bills','Abrir Facturas'), onPress: () => router.replace('/(tabs)/bills') }} /></Screen>; }
export function statusText(status: CaseStatus, copy: (en: string, es: string) => string) {
  return ({ needs_details: copy('Needs details','Faltan datos'), ready: copy('Ready to review','Listo para revisar'), action_prepared: copy('Draft prepared','Borrador preparado'), submitted: copy('Marked submitted','Marcado como enviado'), resolved: copy('Resolved','Resuelto') })[status];
}
export function CaseRow({ billCase }: { billCase: BillCase }) {
  const { colors } = useTheme(); const { locale, copy, formatLocale } = useLanguage();
  const profile = useFootnoteStore(s => s.profiles.find(p => p.id === billCase.profileId));
  const tone = ({ needs_details:'warning', ready:'accent', action_prepared:'draft', submitted:'accent', resolved:'success' } as const)[billCase.status];
  const provider = billCase.provider || copy('Untitled bill','Factura sin título');
  const balance = !billCase.provider && billCase.status === 'needs_details' ? copy('Not entered','Sin ingresar') : formatMoney(billCase.financials.remainingCents,locale);
  const action = billCase.status === 'resolved' ? copy('Update case','Actualizar caso') : billCase.status === 'needs_details' ? copy('Check details','Verificar datos') : copy('Open review','Abrir revisión');
  return <View style={{ borderRadius:radius.card,borderWidth:1,borderColor:colors[tone]+'44',backgroundColor:colors.surface,boxShadow:shadows.paper,overflow:'hidden' }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${provider}, ${balance}, ${statusText(billCase.status,copy)}, ${action}`} onPress={()=>caseRoute(billCase.status==='resolved'?'/timeline':billCase.status==='needs_details'?'/verify':'/review',billCase.id)} style={({pressed})=>({padding:20,gap:space.lg,opacity:pressed?.92:1})}>
      <Group gap={space.md} style={{flexDirection:'row',alignItems:'flex-start'}}><Group gap={space.xs} style={{flex:1,minWidth:0}}><Txt variant="item" numberOfLines={2} translate={!billCase.provider}>{provider}</Txt><Txt variant="caption" muted translate={!profile?.firstName}>{profile?.firstName??copy('Unassigned','Sin perfil')}</Txt></Group><View style={{maxWidth:128}}><Badge text={statusText(billCase.status,copy)} tone={tone}/></View></Group>
      <Group gap={space.md} style={{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between'}}><Group gap={space.xs} style={{flex:1}}><Txt variant="caption" muted>{copy('Statement balance','Saldo de la factura')}</Txt><Txt variant="title">{balance}</Txt></Group><Group gap={space.xs} style={{alignItems:'flex-end'}}><Txt variant="caption" muted>{formatDate(billCase.serviceDate,formatLocale)}</Txt><Txt variant="caption" muted>{billCase.attachments.length} {billCase.attachments.length===1?'document':'documents'}</Txt></Group></Group>
      <Group style={{flexDirection:'row',alignItems:'center',gap:space.sm}}><Txt variant="label" accent style={{flex:1}}>{action}</Txt><Icon name="next" size={18} color={colors.accent}/></Group>
    </Pressable>
    <View style={{borderTopWidth:1,borderTopColor:colors.line,paddingHorizontal:12,paddingVertical:4,backgroundColor:colors[tone+'Soft' as keyof typeof colors]}}><CaseReminder billCase={billCase} compact/></View>
  </View>;
}

export function EmptyBills() { const { colors } = useTheme(); const { copy } = useLanguage(); return <Group gap={space.screen}><Icon name="document" size={40} feature color={colors.accent} /><Txt variant="title">{copy('No bills yet.','Aún no hay facturas.')}</Txt><Txt muted>{copy('Add a bill or explanation of benefits to get started.','Agrega una factura o explicación de beneficios para comenzar.')}</Txt><Button title={copy('Add documents','Agregar documentos')} onPress={() => router.push('/intake')} /></Group>; }
