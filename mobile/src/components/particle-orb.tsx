import { useEffect, useId, useMemo, useState } from 'react';
import { AppState, Platform, Pressable } from 'react-native';
import { useIsFocused } from 'expo-router/react-navigation';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, ClipPath, Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, interpolateColor, useAnimatedProps, useAnimatedStyle, useFrameCallback, useDerivedValue, useSharedValue, withDelay, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { orbParticles, orbPaths } from '@/domain/orb-particles';
import { useFootnoteStore } from '@/store';
import { useTheme } from '@/theme';
import type { NarrationStatus } from '@/native/narration-controller';
const Layer = Animated.createAnimatedComponent(Path);
const Control = Animated.createAnimatedComponent(Pressable);
const Reveal = Animated.createAnimatedComponent(Rect);
const particles = orbParticles();
export function ParticleOrb({ status, onPress, onLongPress, label, size = 132, onCollapse, onExpand, collapsed = false, enter = true, interactive = true, active = true, collapseProgress, level }: { status: NarrationStatus | 'listening'; onPress?: () => void; onLongPress?: () => void; label: string; size?: number; onCollapse?: () => void; onExpand?: () => void; collapsed?: boolean; enter?: boolean; interactive?: boolean; active?: boolean; collapseProgress?: SharedValue<number>; level?: SharedValue<number> }) {
  const { colors, reducedMotion } = useTheme();
  const gradientId = `orbSoftening${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const clipId = `${gradientId}Clip`;
  const haptics = useFootnoteStore(s => s.preferences.haptics);
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const angle = useSharedValue(.5), tilt = useSharedValue(.32), time = useSharedValue(0), activity = useSharedValue(0);
  const drive = useDerivedValue(() => level ? activity.get() * (.35 + .65 * level.get()) : activity.get());
  const paths = useDerivedValue(() => orbPaths(particles, angle.get(), time.get(), drive.get(), tilt.get()));
  const momentum = useSharedValue(0), dragging = useSharedValue(false), committed = useSharedValue(false), scale = useSharedValue(1), entrance = useSharedValue(enter ? 1 : 0);
  const reveal = useSharedValue(collapsed ? 0 : 1);
  const dragStart = useSharedValue(collapsed ? 0 : 1);
  const collapsedHeight = Math.round(size * 64 / 132), travel = size - collapsedHeight;
  useDerivedValue(() => { collapseProgress?.set((1 - reveal.get()) * travel); });
  const frame = useFrameCallback(info => {
    // Follow the display refresh rate. Projection stays on the UI thread and updates only three paths.
    const dt = Math.min(info.timeSincePreviousFrame ?? 16.67, 32) / 1000;
    time.set(t => t + dt);
    if (!dragging.get()) {
      angle.set(a => (a + dt * (.22 + drive.get() * .7 + momentum.get())) % (Math.PI * 2));
      momentum.set(v => v * Math.exp(-2.8 * dt));
    }
  }, false);
  useEffect(() => { const sub = AppState.addEventListener('change', state => setForeground(state === 'active')); return () => sub.remove(); }, []);
  useEffect(() => { frame.setActive(active && focused && foreground && !reducedMotion && !collapsed); return () => frame.setActive(false); }, [frame, active, focused, foreground, reducedMotion, collapsed]);
  useEffect(() => { activity.set(withTiming(status === 'speaking' ? 1 : status === 'loading' ? .65 : status === 'listening' ? .35 : 0, { duration: reducedMotion ? 0 : 240, easing: Easing.bezier(.23, 1, .32, 1) })); }, [activity, status, reducedMotion]);
  useEffect(() => {
    reveal.set(withSpring(collapsed ? 0 : 1, { duration: reducedMotion ? 0 : 280, dampingRatio: .92 }));
  }, [collapsed, reveal, reducedMotion]);
  useEffect(() => {
    if (!enter || reducedMotion) entrance.set(0);
    else { entrance.set(1); if (focused) entrance.set(withDelay(180, withTiming(0, { duration: 420, easing: Easing.bezier(.23, 1, .32, 1) }))); }
    return () => cancelAnimation(entrance);
  }, [enter, entrance, focused, reducedMotion]);
  const feedback = useMemo(() => () => { if (Platform.OS !== 'web' && haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }, [haptics]);
  const pan = useMemo(() => Gesture.Pan().minDistance(8)
    .onStart(() => { dragging.set(true); committed.set(false); momentum.set(0); cancelAnimation(reveal); dragStart.set(reveal.get()); })
    .onChange(event => {
      if (onCollapse) {
        const progress = Math.max(0, Math.min(1, dragStart.get() - event.translationY / travel));
        reveal.set(progress);
      }
      if (!reducedMotion && !collapsed) { angle.set(a => a + event.changeX * .025); tilt.set(t => Math.max(-1.1, Math.min(1.1, t + event.changeY * .004))); }
    })
    .onEnd(event => {
      const down = event.translationY > 44 && event.translationY > Math.abs(event.translationX) * .8 || event.velocityY > 650 && event.translationY > 20;
      const up = event.translationY < -36 && -event.translationY > Math.abs(event.translationX) * .8 || event.velocityY < -650 && event.translationY < -12;
      if (collapsed && onExpand && up) { committed.set(true); reveal.set(withSpring(1, { duration: reducedMotion ? 0 : 280, dampingRatio: .92, velocity: -event.velocityY / travel })); scheduleOnRN(onExpand); scheduleOnRN(feedback); }
      else if (!collapsed && onCollapse && down) { committed.set(true); reveal.set(withSpring(0, { duration: reducedMotion ? 0 : 280, dampingRatio: .92, velocity: -event.velocityY / travel })); scheduleOnRN(onCollapse); scheduleOnRN(feedback); }
      if (!reducedMotion && !collapsed) { momentum.set(Math.max(-12, Math.min(12, event.velocityX * .018))); tilt.set(withSpring(.32, { duration: 400, dampingRatio: .8, velocity: event.velocityY * .008 })); }
    })
    .onFinalize(() => {
      dragging.set(false);
      if (!committed.get()) reveal.set(withSpring(collapsed ? 0 : 1, { duration: reducedMotion ? 0 : 280, dampingRatio: .92 }));
      scale.set(withTiming(1, { duration: reducedMotion ? 0 : 140 }));
    }), [angle, tilt, momentum, dragging, committed, scale, reveal, dragStart, feedback, reducedMotion, collapsed, onCollapse, onExpand, travel]);
  const style = useAnimatedStyle(() => ({ opacity: 1 - entrance.get(), transform: [{ translateY: 90 * entrance.get() + (collapsed ? 0 : travel) - travel * reveal.get() }, { scale: scale.get() * (.65 + .35 * (1 - entrance.get())) * (.91 + .09 * reveal.get()) }] }));
  const clipProps = useAnimatedProps(() => ({ height: (collapsedHeight + travel * reveal.get()) / size * 56 }));
  const control = <Control pointerEvents={interactive ? 'auto' : 'none'} accessible={interactive} accessibilityRole={interactive ? 'button' : undefined} accessibilityLabel={interactive ? label : undefined} accessibilityHint={interactive ? 'Tap to start or mute the conversation. Hold for voice controls. Drag sideways to spin; swipe down to minimize.' : undefined} accessibilityActions={onLongPress ? [{ name: 'longpress', label: 'Voice conversation controls' }] : undefined} onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'longpress') onLongPress?.(); }} accessibilityState={{ busy: status === 'loading', expanded: interactive ? !collapsed : undefined }} onPressIn={() => scale.set(withTiming(reducedMotion ? 1 : .96, { duration: reducedMotion ? 0 : 120 }))} onPressOut={() => scale.set(withTiming(1, { duration: reducedMotion ? 0 : 140 }))} delayLongPress={500} onLongPress={onLongPress ? () => { feedback(); onLongPress(); } : undefined} onPress={() => { feedback(); if (collapsed) onExpand?.(); if (!reducedMotion) momentum.set(2.4); onPress?.(); }} style={[{ width: size, height: collapsed ? collapsedHeight : size, borderRadius: size / 2 }, style]}>
    <Svg pointerEvents="none" aria-hidden={true} width={size} height={size} viewBox="0 0 56 56" style={{ position: 'absolute', top: 0, flexShrink: 0 }}>
      <Defs>
        <RadialGradient id={gradientId}><Stop offset="0" stopColor={colors.background}/><Stop offset={.68} stopColor={colors.background} stopOpacity={.98}/><Stop offset={.86} stopColor={colors.background} stopOpacity={.65}/><Stop offset="1" stopColor={colors.background} stopOpacity={0}/></RadialGradient>
        <ClipPath id={clipId}><Reveal x={0} y={0} width={56} animatedProps={clipProps}/></ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Circle cx={28} cy={28} r={28} fill={`url(#${gradientId})`}/>
        {([0, 1, 2] as const).map(index => <ParticleLayer key={index} index={index} paths={paths} activity={activity} ink={colors.ink} accent={colors.accent} />)}
      </G>
    </Svg>
  </Control>;
  return interactive ? <GestureDetector gesture={pan}>{control}</GestureDetector> : control;
}
function ParticleLayer({ index, paths, activity, ink, accent }: { index: 0|1|2; paths: SharedValue<[string, string, string]>; activity: SharedValue<number>; ink: string; accent: string }) {
  const props = useAnimatedProps(() => ({ d: paths.get()[index], fill: interpolateColor(activity.get(), [0, 1], [ink, accent]) }));
  return <Layer animatedProps={props} opacity={[.3, .6, .95][index]} />;
}
