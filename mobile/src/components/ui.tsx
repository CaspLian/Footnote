import { ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextProps, useWindowDimensions, View, ViewStyle } from 'react-native';
import Animated, { cubicBezier, FadeIn, useReducedMotion } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnfoldStore } from '@/store';
import { colors, gradients, motion, fonts, radius, shadows, sizes, space, type } from '@/theme';
import { Icon, IconName } from './icon';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function useLanguage() {
  const locale = useUnfoldStore(s => s.locale);
  const copy = useCallback((en: string, es: string) => locale === 'es' ? es : en, [locale]);
  return { locale, copy };
}
export function useDesktop() { const {width}=useWindowDimensions(); return Platform.OS==='web'&&width>=1080; }
export function Txt({ variant = 'body', muted, accent, style, ...props }: TextProps & { variant?: keyof typeof type; muted?: boolean; accent?: boolean }) {
  return <Text {...props} style={[type[variant], { color: accent ? colors.accent : muted ? colors.muted : colors.ink }, style]} />;
}
export function Button({ title, onPress, variant = 'primary', disabled, loading, icon, style, testID }: { title: string; onPress: () => void; variant?: 'primary'|'secondary'|'quiet'; disabled?: boolean; loading?: boolean; icon?: IconName; style?: StyleProp<ViewStyle>; testID?: string }) {
  const [pressed,setPressed]=useState(false); const [hovered,setHovered]=useState(false);const [focused,setFocused]=useState(false);const reduced=useReducedMotion();
  const color = variant === 'primary' ? colors.surface : colors.accent;
  return <AnimatedPressable testID={testID} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }} disabled={disabled || loading} onPressIn={()=>setPressed(true)} onPressOut={()=>setPressed(false)} onHoverIn={()=>setHovered(true)} onHoverOut={()=>setHovered(false)} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onPress={() => { if(Platform.OS!=='web')void Haptics.selectionAsync().catch(() => {}); onPress(); }} style={[styles.button, variant==='quiet'?styles.quiet:variant==='secondary'?styles.secondary:styles.primary, { backgroundColor: variant === 'primary' ? colors.accent : hovered ? colors.accentSoft : variant==='secondary'?colors.surface:'transparent', opacity: disabled ? .45 : pressed ? .84 : 1, transform: [{scale:pressed&&!reduced?.98:1}], boxShadow:focused?'0 0 0 3px rgba(23,107,91,.24)':variant==='primary'?shadows.control:'none', transitionProperty: ['transform','opacity','backgroundColor'], transitionDuration:motion.press,transitionTimingFunction:cubicBezier(.23,1,.32,1) }, style]}>
    {loading ? <ActivityIndicator color={color} /> : icon ? <Icon name={icon} color={color} size={20} /> : null}<Txt variant="label" style={{ color, textAlign: 'center', flexShrink: 1 }}>{title}</Txt>
  </AnimatedPressable>;
}
export function IconButton({ name, label, onPress }: { name: IconName; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, { backgroundColor:pressed?colors.accentSoft:'transparent' }]}><Icon name={name} /></Pressable>;
}
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) { return <View style={[styles.card, style]}>{children}</View>; }
export function Hero({children}:{children:ReactNode}){return <LinearGradient colors={gradients.paper} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.card,{gap:space.lg}]}>{children}</LinearGradient>;}
export function Divider(){return <View style={{height:StyleSheet.hairlineWidth,backgroundColor:colors.line}}/>;}
export function Group({ children, gap = space.sm, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) { return <View style={[{ gap }, style]}>{children}</View>; }
export function Section({title,children}:{title:string;children:ReactNode}) {return <Group gap={space.lg}><Txt variant="section">{title}</Txt>{children}</Group>;}
export function Choice({title,detail,selected,onPress}:{title:string;detail?:string;selected:boolean;onPress:()=>void}){return <Pressable accessibilityRole="radio" aria-checked={selected} accessibilityLabel={title} accessibilityState={{checked:selected}} onPress={onPress} style={({pressed})=>({minHeight:sizes.touch,padding:space.lg,borderRadius:radius.control,backgroundColor:selected?colors.surface:pressed?colors.accentSoft:'transparent',boxShadow:selected?shadows.paper:'none',flexDirection:'row',alignItems:'center',gap:space.lg})}><Group style={{flex:1}} gap={space.xs}><Txt variant="label" accent={selected}>{title}</Txt>{detail?<Txt muted>{detail}</Txt>:null}</Group><Icon name={selected?'check':'next'} color={selected?colors.accent:colors.muted} size={20}/></Pressable>;}
export function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <View style={styles.row}><Txt variant="label" muted style={{ flex: 1 }}>{label}</Txt><Txt accent={accent} style={{ flexShrink: 1, textAlign: 'right' }}>{value}</Txt></View>;
}
export function Badge({ text }: { text: string }) { return <View style={styles.badge}><Txt variant="caption" style={{ color: colors.warning }}>{text}</Txt></View>; }
export function Field({ label, help, error, style, ...props }: TextInputProps & { label: string; help?: string; error?: string; style?: StyleProp<ViewStyle> }) {
  const [focused,setFocused]=useState(false);
  return <Group gap={space.sm}><View style={[styles.field, error ? { borderColor: colors.error } : focused?{borderColor:colors.accent}:null, style]}><Txt variant="label" muted>{label}</Txt><TextInput {...props} onFocus={e=>{setFocused(true);props.onFocus?.(e);}} onBlur={e=>{setFocused(false);props.onBlur?.(e);}} accessibilityLabel={label} style={[type.body, { color: colors.ink, padding: 0, minHeight: 38, textAlignVertical: 'top' }]} placeholderTextColor={colors.muted} /></View>{help ? <Txt variant="caption" muted>{help}</Txt> : null}{error ? <Txt variant="caption" accessibilityRole="alert" style={{ color: colors.error }}>{error}</Txt> : null}</Group>;
}
export function EvidenceCard({ source, excerpt, onPress }: { source: string; excerpt: string; onPress?: () => void }) {
  const content = <><Group style={{flexDirection:'row',alignItems:'center'}}><Icon name="document" size={20} color={colors.accent}/><Txt variant="label" accent style={{flex:1}}>{source}</Txt>{onPress ? <Icon name="next" color={colors.accent} size={20} /> : null}</Group><Txt>{excerpt}</Txt></>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={source} onPress={onPress} style={({ pressed }) => [styles.evidence, { opacity: pressed ? .7 : 1 }]}>{content}</Pressable> : <View style={styles.evidence}>{content}</View>;
}
export function Feedback({ title, text, action, danger }: { title?: string; text: string; action?: { title: string; onPress: () => void }; danger?: boolean }) {
  return <View accessibilityLiveRegion="polite" style={[styles.evidence, { backgroundColor: danger ? colors.errorSoft : colors.accentSoft }]}>{title ? <Txt variant="section">{title}</Txt> : null}<Txt style={danger ? { color: colors.error } : null}>{text}</Txt>{action ? <Button {...action} variant="quiet" /> : null}</View>;
}
export function Screen({ children, footer, aside, asideWidth, testID }: { children: ReactNode; footer?: ReactNode; aside?:ReactNode; asideWidth?:number; testID?: string }) {
  const insets = useSafeAreaInsets();const desktop=useDesktop();const reduced=useReducedMotion();
  const storageError = useUnfoldStore(s => s.storageError); const { copy } = useLanguage();
  return <KeyboardAvoidingView testID={testID} style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + sizes.header : 0}>
    {storageError ? <View style={{ paddingHorizontal: space.screen, paddingTop: space.md }}><Feedback danger text={copy('Your changes could not be saved. Keep the app open and try saving again.', 'No se pudieron guardar tus cambios. Mantén la app abierta e intenta guardar de nuevo.')} action={{ title: copy('Try saving again','Intentar guardar de nuevo'), onPress: () => { void useUnfoldStore.getState().retryPersistence().catch(()=>{}); } }} /></View> : null}
    <ScrollView contentContainerStyle={[styles.content,desktop?{padding:space.xxl}:null]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentInsetAdjustmentBehavior="automatic"><View style={{width:'100%',maxWidth:desktop?1120:720,alignSelf:'center',flexDirection:desktop&&aside?'row':'column',gap:space.xl}}>{desktop&&aside?<View style={asideWidth?{width:asideWidth}:{flex:1}}>{aside}</View>:null}<Animated.View entering={reduced?undefined:FadeIn.duration(motion.transition)} style={{flex:1,minWidth:0,gap:space.xl}}>{children}</Animated.View></View></ScrollView>
    {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.lg),alignItems:desktop?'flex-end':undefined }]}><View style={{width:desktop?280:'100%'}}>{footer}</View></View> : null}
  </KeyboardAvoidingView>;
}
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },content: { padding: space.screen, paddingBottom: space.xxl },
  footer: { paddingHorizontal: space.screen, paddingTop: space.md, backgroundColor: colors.background, gap: space.sm },
  button: { minHeight: sizes.touch, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.control, borderCurve: 'continuous', flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center' },
  primary:{minHeight:sizes.button},secondary:{alignSelf:'flex-start',borderWidth:1,borderColor:colors.line},quiet:{alignSelf:'flex-start',paddingHorizontal:0,borderRadius:radius.small},
  iconButton: { minWidth: sizes.touch, minHeight: sizes.touch, alignItems: 'center', justifyContent: 'center',borderRadius:radius.small },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderCurve: 'continuous', padding: space.screen, gap: space.lg,boxShadow:shadows.paper },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg },badge: { backgroundColor: colors.warningSoft, borderRadius: radius.small, paddingHorizontal: space.md, paddingVertical: space.sm, alignSelf: 'flex-start' },
  field: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: radius.control, borderCurve: 'continuous', padding: space.lg, gap: space.xs },
  evidence: { backgroundColor: colors.accentSoft, borderRadius: radius.control, borderCurve: 'continuous', padding: space.lg, gap: space.md },
  page: { backgroundColor: colors.surface, padding: space.screen, borderRadius: radius.card, minHeight: sizes.draft, fontFamily: fonts.regular,boxShadow:shadows.paper },
});
