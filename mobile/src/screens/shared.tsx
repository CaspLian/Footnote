import { useLocalSearchParams, router } from 'expo-router';
import { Pressable } from 'react-native';
import { useUnfoldStore } from '@/store';
import { BillCase, CaseStatus, formatDate, formatMoney } from '@/domain';
import { Badge, Button, Divider, Feedback, Group, Row, Screen, Txt, useLanguage } from '@/components/ui';
import { Icon } from '@/components/icon';
import { colors, space } from '@/theme';

export function useCase() {
  const params = useLocalSearchParams<{ caseId?: string }>();
  const active = useUnfoldStore(s => s.activeCaseId);
  const cases = useUnfoldStore(s => s.cases);
  return cases.find(c => c.id === (params.caseId ?? active)) ?? (params.caseId ? undefined : cases[0]);
}
export function caseRoute(pathname: '/review'|'/verify'|'/timeline'|'/draft'|'/intake', id: string) { router.push({ pathname, params: { caseId: id } }); }
export function MissingCase() { const { copy } = useLanguage(); return <Screen><Feedback title={copy('This case is unavailable.','Este caso no está disponible.')} text={copy('It may have been removed. Open Bills to choose a case.','Puede haberse eliminado. Abre Facturas para elegir un caso.')} action={{ title: copy('Open Bills','Abrir Facturas'), onPress: () => router.replace('/(tabs)/bills') }} /></Screen>; }
export function statusText(status: CaseStatus, copy: (en: string, es: string) => string) {
  return ({ needs_details: copy('Needs details','Faltan datos'), ready: copy('Ready to review','Listo para revisar'), action_prepared: copy('Draft prepared','Borrador preparado'), submitted: copy('Marked submitted','Marcado como enviado'), resolved: copy('Resolved','Resuelto') })[status];
}
export function CaseRow({ billCase }: { billCase: BillCase }) {
  const { locale, copy } = useLanguage();
  const profile=useUnfoldStore(s=>s.profiles.find(p=>p.id===billCase.profileId));
  return <Pressable accessibilityRole="button" accessibilityLabel={`${billCase.provider}, ${formatMoney(billCase.financials.remainingCents, locale)}, ${statusText(billCase.status,copy)}`} onPress={() => caseRoute(billCase.status === 'needs_details' ? '/verify' : '/review', billCase.id)} style={({ pressed }) => ({ opacity: pressed ? .7 : 1 })}>
    <Group gap={space.lg}><Group><Txt variant="section">{billCase.provider || copy('Untitled bill','Factura sin título')}</Txt><Txt variant="label" muted>{profile?.firstName??copy('Unassigned','Sin perfil')} · {formatDate(billCase.serviceDate,locale)}{billCase.source === 'sample' ? copy(' · Sample',' · Ejemplo') : ''}</Txt></Group><Row label={copy('Statement balance','Saldo de la factura')} value={formatMoney(billCase.financials.remainingCents,locale)} /><Badge text={statusText(billCase.status,copy)} /><Group style={{ flexDirection: 'row', alignItems: 'center' }}><Txt variant="caption" muted style={{ flex: 1 }}>{billCase.followUpDate ? copy('Follow-up: ','Seguimiento: ')+formatDate(billCase.followUpDate,locale) : copy('Follow-up date not set','Sin fecha de seguimiento')}</Txt><Icon name="next" color={colors.muted} /></Group><Divider/></Group>
  </Pressable>;
}
export function EmptyBills() { const { copy } = useLanguage(); return <Group gap={space.screen}><Icon name="document" size={40} feature color={colors.accent} /><Txt variant="title">{copy('No bills yet.','Aún no hay facturas.')}</Txt><Txt muted>{copy('Add a bill or explore the paired synthetic bill and EOB.','Agrega una factura o explora la factura y EOB de ejemplo.')}</Txt><Button title={copy('Add documents','Agregar documentos')} onPress={() => router.push('/intake')} /></Group>; }
