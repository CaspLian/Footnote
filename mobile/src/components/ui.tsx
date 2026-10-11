import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState, useEffect } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextProps, useWindowDimensions, View, ViewStyle } from 'react-native';
import Animated, { cubicBezier, useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnfoldStore } from '@/store';
import { motion, fonts, radius, shadows, sizes, space, type, useTheme, useMotionPreference, type Palette } from '@/theme';
import { Icon, IconName } from './icon';
import { GlassSurface, useGlassAvailable } from './glass-surface';
import { SoftScrollView } from './soft-scroll';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const ActionLayout = createContext({ row: false, dock: false });

export function useLanguage() {
  const locale = useUnfoldStore(s => s.locale);
  const copy = useCallback((en: string, es: string) => locale === 'es' ? es : en, [locale]);
  return { locale, copy };
}
export function useDesktop() { const {width}=useWindowDimensions(); return Platform.OS==='web'&&width>=1080; }
export function Txt({ variant = 'body', muted, accent, style, ...props }: TextProps & { variant?: keyof typeof type; muted?: boolean; accent?: boolean }) { const { colors } = useTheme();
  return <Text {...props} style={[type[variant], { color: accent ? colors.accent : muted ? colors.muted : colors.ink }, style]} />;
}
export function Button({ title, onPress, variant = 'primary', material, compact = false, disabled, loading, icon, style, testID }: { title: string; onPress: () => void; variant?: 'primary'|'secondary'|'quiet'|'link'; material?: 'solid'|'glass'; compact?: boolean; disabled?: boolean; loading?: boolean; icon?: IconName; style?: StyleProp<ViewStyle>; testID?: string }) { const { colors, scheme } = useTheme(); const styles = useUIStyles(); const desktop = useDesktop();
  const layout = useContext(ActionLayout);
  const [pressed,setPressed]=useState(false); const [hovered,setHovered]=useState(false);const [focused,setFocused]=useState(false);const reduced=useMotionPreference();
  const isGlass = (material ?? (variant === 'primary' ? 'glass' : 'solid')) === 'glass'; const nativeGlass = useGlassAvailable();
  const haptics = useUnfoldStore(s => s.preferences.haptics);
  const color = disabled ? colors.muted : variant === 'primary' && !isGlass ? scheme === 'dark' ? '#112C22' : '#FFFEFA' : colors.accent;
  return <AnimatedPressable testID={testID} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }} disabled={disabled || loading} onPressIn={()=>setPressed(true)} onPressOut={()=>setPressed(false)} onHoverIn={()=>setHovered(true)} onHoverOut={()=>setHovered(false)} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onPress={() => { if(Platform.OS!=='web'&&haptics)void Haptics.selectionAsync().catch(() => {}); onPress(); }} style={[styles.button, variant==='link'?styles.link:variant==='quiet'?styles.quiet:variant==='secondary'?styles.secondary:styles.primary, layout.row && !compact ? { flexGrow: 1, flexBasis: 0, minWidth: 88, alignSelf: 'stretch' } : !desktop && !compact && variant !== 'link' ? { alignSelf: 'stretch', width: '100%' } : null, layout.dock ? { minHeight: 48, paddingVertical: 10, paddingHorizontal: 12 } : null, { backgroundColor: isGlass ? 'transparent' : variant === 'primary' ? colors.accent : hovered ? colors.accentSoft : variant === 'secondary' ? colors.surface : variant === 'quiet' ? colors.accentSoft : 'transparent', opacity: nativeGlass && isGlass ? 1 : disabled ? .45 : pressed ? .84 : 1, transform: [{scale:pressed&&!reduced?.98:1}], boxShadow:focused?'0 0 0 3px rgba(23,107,91,.24)':isGlass ? nativeGlass ? 'none' : shadows.control : variant==='primary'?shadows.control:'none', transitionProperty: ['transform','opacity','backgroundColor'], transitionDuration:motion.press,transitionTimingFunction:cubicBezier(.23,1,.32,1) }, style]}>
    {isGlass ? <GlassSurface tinted style={[StyleSheet.absoluteFill, { borderRadius: radius.control }]} /> : null}
    {loading ? <ActivityIndicator color={color} /> : icon ? <Icon name={icon} color={color} size={20} /> : null}<Txt variant="label" style={{ color, textAlign: 'center', flexShrink: 1 }}>{title}</Txt>
  </AnimatedPressable>;
}
export function IconButton({ name, label, onPress, disabled = false, plain = false }: { name: IconName; label: string; onPress: () => void; disabled?: boolean; plain?: boolean }) { const { colors } = useTheme(); const styles = useUIStyles();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.iconButton, { opacity:disabled?.4:1, backgroundColor:pressed?colors.accentSoft:plain?'transparent':colors.surface }]}><Icon name={name} /></Pressable>;
}
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) { const styles = useUIStyles(); return <View style={[styles.card, style]}>{children}</View>; }
export function Hero({children}:{children:ReactNode}){ const { gradients } = useTheme(); const styles = useUIStyles();return <LinearGradient colors={gradients.paper} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.card,{gap:space.lg}]}>{children}</LinearGradient>;}
export function Divider(){ const { colors } = useTheme();return <View style={{height:StyleSheet.hairlineWidth,backgroundColor:colors.line}}/>;}
export function Group({ children, gap = space.sm, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) { return <View style={[{ gap }, style]}>{children}</View>; }
export function ButtonRow({ children, style, stack = false }: { children: ReactNode; style?: StyleProp<ViewStyle>; stack?: boolean }) { const parent = useContext(ActionLayout); return <ActionLayout.Provider value={{ ...parent, row: !stack }}><View style={[{ flexDirection: stack ? 'column' : 'row', flexWrap: 'wrap', gap: space.md, alignItems: 'stretch' }, style]}>{children}</View></ActionLayout.Provider>; }
export function Section({title,children}:{title:string;children:ReactNode}) {return <Group gap={space.lg}><Txt variant="heading" accessibilityRole="header">{title}</Txt>{children}</Group>;}
export function Choice({title,detail,selected,onPress}:{title:string;detail?:string;selected:boolean;onPress:()=>void}){ const { colors } = useTheme();return <Pressable accessibilityRole="radio" aria-checked={selected} accessibilityLabel={title} accessibilityState={{checked:selected}} onPress={onPress} style={({pressed})=>({minHeight:sizes.touch,padding:space.lg,borderRadius:radius.control,backgroundColor:selected?colors.surface:pressed?colors.accentSoft:'transparent',boxShadow:selected?shadows.paper:'none',flexDirection:'row',alignItems:'center',gap:space.lg})}><Group style={{flex:1}} gap={space.xs}><Txt variant="label" accent={selected}>{title}</Txt>{detail?<Txt muted>{detail}</Txt>:null}</Group><Icon name={selected?'check':'next'} color={selected?colors.accent:colors.muted} size={20}/></Pressable>;}
export function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) { const styles = useUIStyles();
  return <View style={styles.row}><Txt variant="label" muted style={{ flex: 1 }}>{label}</Txt><Txt accent={accent} style={{ flexShrink: 1, textAlign: 'right' }}>{value}</Txt></View>;
}
export function Badge({ text, tone = 'warning' }: { text: string; tone?: 'warning'|'accent'|'info'|'success'|'draft' }) { const { colors } = useTheme(); const styles = useUIStyles(); return <View style={[styles.badge,{backgroundColor:colors[`${tone}Soft`]}]}><Txt variant="caption" style={{ color: colors[tone] }}>{text}</Txt></View>; }
export function Field({ label, help, error, style, ...props }: TextInputProps & { label: string; help?: string; error?: string; style?: StyleProp<ViewStyle> }) { const { colors } = useTheme(); const styles = useUIStyles();
  const [focused,setFocused]=useState(false);
  const input = useRef<TextInput>(null);
  const editable = props.editable !== false;
  return <Group gap={space.sm}><Pressable accessible={false} focusable={false} onPress={() => { if (editable) input.current?.focus(); }} style={[styles.field, { borderWidth: focused ? 2 : 1, padding: focused ? space.lg - 1 : space.lg, borderColor: error ? colors.error : focused ? colors.accent : colors.line, opacity: editable ? 1 : .65 }, style]}><Group style={{ flexDirection: 'row', alignItems: 'center' }}><Txt variant="label" muted style={{ flex: 1 }}>{label}</Txt>{editable ? <Icon name="edit" size={16} color={colors.muted} /> : null}</Group><TextInput {...props} ref={input} onFocus={e=>{setFocused(true);props.onFocus?.(e);}} onBlur={e=>{setFocused(false);props.onBlur?.(e);}} accessibilityLabel={label} accessibilityHint={props.accessibilityHint ?? (editable ? 'Editable field. Enter or change this value.' : 'Read-only value.')} selectionColor={colors.accent} style={[type.body, { color: colors.ink, padding: 0, minHeight: 38, textAlignVertical: 'top' }]} placeholderTextColor={colors.muted} /></Pressable>{help ? <Txt variant="caption" muted>{help}</Txt> : null}{error ? <Txt variant="caption" accessibilityRole="alert" style={{ color: colors.error }}>{error}</Txt> : null}</Group>;
}
export function EvidenceCard({ source, excerpt, onPress }: { source: string; excerpt: string; onPress?: () => void }) { const { colors } = useTheme(); const styles = useUIStyles();
  const content = <><Group style={{flexDirection:'row',alignItems:'center'}}><Icon name="document" size={20} color={colors.accent}/><Txt variant="label" accent style={{flex:1}}>{source}</Txt>{onPress ? <Icon name="next" color={colors.accent} size={20} /> : null}</Group><Txt>{excerpt}</Txt></>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={source} onPress={onPress} style={({ pressed }) => [styles.evidence, { opacity: pressed ? .7 : 1 }]}>{content}</Pressable> : <View style={styles.evidence}>{content}</View>;
}
export function Feedback({ title, text, action, danger, onDismiss }: { title?: string; text: string; action?: { title: string; onPress: () => void }; danger?: boolean; onDismiss?: () => void }) { const { colors } = useTheme(); const styles = useUIStyles();
  const recovery = useRef(action);
  const dismiss = useRef(onDismiss);
  useEffect(() => { recovery.current = action; dismiss.current = onDismiss; }, [action, onDismiss]);
  useEffect(() => {
    if (Platform.OS !== 'ios' || !danger) return;
    const retry = recovery.current;
    Alert.alert(title ?? 'Something needs attention', text, retry ? [{ text: 'Dismiss', style: 'cancel', onPress: () => dismiss.current?.() }, { text: retry.title, onPress: () => { dismiss.current?.(); retry.onPress(); } }] : [{ text: 'OK', onPress: () => dismiss.current?.() }]);
  }, [danger, text, title]);
  // Keep recovery available after the alert is dismissed, without repeating the error card.
  if (Platform.OS === 'ios' && danger) return action ? <Button {...action} variant="quiet" /> : null;
  return <View accessibilityLiveRegion="polite" style={[styles.evidence, { backgroundColor: danger ? colors.errorSoft : colors.accentSoft }]}>{title ? <Txt variant="section">{title}</Txt> : null}<Txt style={danger ? { color: colors.error } : null}>{text}</Txt>{action ? <Button {...action} variant="quiet" /> : null}</View>;
}
export function Screen({ children, footer, aside, asideWidth, contentWidth, footerHint, overlay, overlaySpace = 184, overlayReserve = 0, measureOverlay = false, footerSafeArea = true, footerBottomGap = 16, overlayBottom = 4, showStorageError = true, softenSearchEdge = false, scrollEdgeHeight = 28, searchMode = false, testID }: { children: ReactNode; footerHint?: string; footer?: ReactNode; overlay?: ReactNode; overlaySpace?: number; overlayReserve?: number; measureOverlay?: boolean; footerSafeArea?: boolean; footerBottomGap?: number; overlayBottom?: number; showStorageError?: boolean; softenSearchEdge?: boolean; scrollEdgeHeight?: number; searchMode?: boolean; aside?:ReactNode; asideWidth?:number; contentWidth?:number; testID?: string }) { const styles = useUIStyles();
  const insets = useSafeAreaInsets();const desktop=useDesktop();const {colors,reducedMotion}=useTheme();
  const hasOverlay = !!overlay; const reserve = useSharedValue(overlayReserve); const [overlayHeight, setOverlayHeight] = useState<number>();
  const reservedHeight = measureOverlay && overlayHeight !== undefined ? overlayHeight + overlayBottom : overlayReserve;
  useEffect(()=>{reserve.set(withTiming(hasOverlay ? reservedHeight : 0,{duration:reducedMotion?0:280,easing:Easing.bezier(.23,1,.32,1)}));},[reservedHeight,hasOverlay,reducedMotion,reserve]);
  const scrollLayout = useAnimatedStyle(()=>({paddingBottom:reserve.get()}));
  const storageError = useUnfoldStore(s => s.storageError); const { copy } = useLanguage();
  return <KeyboardAvoidingView testID={testID} style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} automaticOffset keyboardVerticalOffset={0}>
    {showStorageError && storageError ? <View style={{ paddingHorizontal: space.screen, paddingTop: space.md }}><Feedback danger text={copy('Your changes could not be saved. Keep the app open and try saving again.', 'No se pudieron guardar tus cambios. Mantén la app abierta e intenta guardar de nuevo.')} action={{ title: copy('Try saving again','Intentar guardar de nuevo'), onPress: () => { void useUnfoldStore.getState().retryPersistence().catch(()=>{}); } }} /></View> : null}
    <View style={{ flex: 1, minHeight: 0 }}><SoftScrollView softenTopAtRest={Platform.OS==='ios'&&softenSearchEdge&&searchMode} topFadeHeight={searchMode?24:scrollEdgeHeight} bottomFadeHeight={hasOverlay?0:searchMode?24:scrollEdgeHeight} contentContainerStyle={[styles.content,desktop?{padding:space.xxl}:null,overlay?{paddingBottom:overlaySpace}:null,searchMode?{paddingTop:space.md,paddingBottom:space.sm}:null]} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} contentInsetAdjustmentBehavior="automatic"><Animated.View style={[{width:'100%',maxWidth:contentWidth ?? (desktop?1120:720),alignSelf:'center',flexDirection:desktop&&aside?'row':'column',gap:space.xl},scrollLayout]}>{desktop&&aside?<View style={asideWidth?{width:asideWidth}:{flex:1}}>{aside}</View>:null}<View style={{flex:1,minWidth:0,gap:searchMode?space.lg:space.xl}}>{children}</View></Animated.View></SoftScrollView>{overlay?<View onLayout={measureOverlay ? e => setOverlayHeight(e.nativeEvent.layout.height) : undefined} pointerEvents="box-none" style={{position:'absolute',bottom:overlayBottom,left:0,right:0,alignItems:'center'}}>{overlay}</View>:null}</View>
    {footer ? <View style={[styles.footer, { paddingBottom: footerSafeArea ? Math.max(insets.bottom, space.sm) : footerBottomGap, alignItems: 'center' }]}>{hasOverlay ? <LinearGradient pointerEvents="none" colors={[`${colors.background}00`, colors.background]} style={{ position: 'absolute', top: -20, left: 0, right: 0, height: 20 }}/> : null}<ActionLayout.Provider value={{ row: false, dock: true }}><View style={{ width: '100%', maxWidth: contentWidth ?? 720, gap: space.sm }}>{footerHint ? <Txt variant="caption" muted numberOfLines={1}>{footerHint}</Txt> : null}{footer}</View></ActionLayout.Provider></View> : null}
  </KeyboardAvoidingView>;
}
const createStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },content: { padding: space.screen, paddingBottom: space.xxl },
  footer: { paddingHorizontal: space.screen, paddingTop: space.sm, backgroundColor: colors.background, gap: space.sm },
  button: { minHeight: sizes.touch, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.control, borderCurve: 'continuous', flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center' },
  primary:{minHeight:sizes.button},secondary:{alignSelf:'flex-start',borderWidth:1,borderColor:colors.line},quiet:{alignSelf:'flex-start',borderRadius:radius.small},link:{alignSelf:'flex-start',paddingHorizontal:0,borderRadius:radius.small},
  iconButton: { minWidth: sizes.touch, minHeight: sizes.touch, alignItems: 'center', justifyContent: 'center',borderRadius:radius.small },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderCurve: 'continuous', padding: space.screen, gap: space.lg,boxShadow:shadows.paper },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg },badge: { backgroundColor: colors.warningSoft, borderRadius: radius.small, paddingHorizontal: space.md, paddingVertical: space.sm, alignSelf: 'flex-start' },
  field: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: radius.control, borderCurve: 'continuous', padding: space.lg, gap: space.xs },
  evidence: { backgroundColor: colors.accentSoft, borderRadius: radius.control, borderCurve: 'continuous', padding: space.lg, gap: space.md },
  page: { backgroundColor: colors.surface, padding: space.screen, borderRadius: radius.card, minHeight: sizes.draft, fontFamily: fonts.regular,boxShadow:shadows.paper },
});

export function useUIStyles() { const { colors } = useTheme(); return useMemo(() => createStyles(colors), [colors]); }
