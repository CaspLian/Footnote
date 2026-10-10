import { useEffect, useMemo, useState } from 'react';
import { AppState, Platform, Pressable } from 'react-native';
import { useIsFocused } from 'expo-router/react-navigation';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, interpolateColor, useAnimatedProps, useAnimatedStyle, useFrameCallback, useDerivedValue, useSharedValue, withDelay, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { orbParticles, orbPaths } from '@/domain/orb-particles';
import { useUnfoldStore } from '@/store';
import { useTheme } from '@/theme';
import type { NarrationStatus } from '@/native/narration-controller';
const Layer = Animated.createAnimatedComponent(Path);
const Control = Animated.createAnimatedComponent(Pressable);
const Aura = Animated.createAnimatedComponent(G);
const particles = orbParticles();
export function ParticleOrb({ status, onPress, label, size = 132, onCollapse, enter = true }: { status: NarrationStatus; onPress: () => void; label: string; size?: number; onCollapse?: () => void; enter?: boolean }) {
  const { colors, reducedMotion } = useTheme();
  const haptics = useUnfoldStore(s => s.preferences.haptics);
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const angle = useSharedValue(.5), tilt = useSharedValue(.32), time = useSharedValue(0), activity = useSharedValue(0);
  const paths = useDerivedValue(() => orbPaths(particles, angle.get(), time.get(), activity.get(), tilt.get()));
  const elapsed = useSharedValue(0);
  const momentum = useSharedValue(0), dragging = useSharedValue(false), hiding = useSharedValue(false), scale = useSharedValue(1), entrance = useSharedValue(enter ? 1 : 0), dragY = useSharedValue(0);
  const frame = useFrameCallback(info => {
    elapsed.set(v => v + Math.min(info.timeSincePreviousFrame ?? 0, 64) / 1000);
    if (elapsed.get() < 1 / 30) return;
    const dt = elapsed.get(); elapsed.set(0);
    time.set(t => t + dt);
    if (!dragging.get()) {
      angle.set(a => (a + dt * (.22 + activity.get() * .7 + momentum.get())) % (Math.PI * 2));
      momentum.set(v => v * Math.exp(-2.8 * dt));
    }
  }, false);
  useEffect(() => { const sub = AppState.addEventListener('change', state => setForeground(state === 'active')); return () => sub.remove(); }, []);
  useEffect(() => { frame.setActive(focused && foreground && !reducedMotion); return () => frame.setActive(false); }, [frame, focused, foreground, reducedMotion]);
  useEffect(() => { activity.set(withTiming(status === 'speaking' ? 1 : status === 'loading' ? .65 : 0, { duration: reducedMotion ? 0 : 240, easing: Easing.bezier(.23, 1, .32, 1) })); }, [activity, status, reducedMotion]);
  useEffect(() => {
    if (!enter || reducedMotion) entrance.set(0);
    else { entrance.set(1); if (focused) entrance.set(withDelay(180, withTiming(0, { duration: 420, easing: Easing.bezier(.23, 1, .32, 1) }))); }
    return () => cancelAnimation(entrance);
  }, [enter, entrance, focused, reducedMotion]);
  const feedback = useMemo(() => () => { if (Platform.OS !== 'web' && haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }, [haptics]);
  const pan = useMemo(() => Gesture.Pan().minDistance(8)
    .onStart(() => { dragging.set(true); hiding.set(false); momentum.set(0); scheduleOnRN(feedback); })
    .onChange(event => { dragY.set(onCollapse ? Math.max(0, event.translationY) * .55 : 0); if (!reducedMotion) { angle.set(a => a + event.changeX * .025); tilt.set(t => Math.max(-1.1, Math.min(1.1, t + event.changeY * .004))); } })
    .onEnd(event => { if (onCollapse && (event.translationY > 44 && event.translationY > Math.abs(event.translationX) * .8 || event.velocityY > 650 && event.translationY > 20)) { hiding.set(true); dragY.set(withTiming(44, { duration: reducedMotion ? 0 : 180 })); scheduleOnRN(onCollapse); } else dragY.set(withSpring(0, { duration: 260, dampingRatio: .9 })); if (!reducedMotion) { momentum.set(Math.max(-12, Math.min(12, event.velocityX * .018))); tilt.set(withSpring(.32, { duration: 400, dampingRatio: .8, velocity: event.velocityY * .008 })); } scheduleOnRN(feedback); })
    .onFinalize(() => { dragging.set(false); if (!hiding.get()) dragY.set(withSpring(0, { duration: 260, dampingRatio: .9 })); scale.set(withTiming(1, { duration: reducedMotion ? 0 : 140 })); }), [angle, tilt, momentum, dragging, hiding, scale, feedback, reducedMotion, onCollapse, dragY]);
  const style = useAnimatedStyle(() => ({ opacity: 1 - entrance.get(), transform: [{ translateY: 90 * entrance.get() + dragY.get() }, { scale: scale.get() * (.65 + .35 * (1 - entrance.get())) }] }));
  const auraProps = useAnimatedProps(() => ({ opacity: Math.max(0, 1 - dragY.get() / 24) }));
  return <GestureDetector gesture={pan}><Control accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Tap to open voice conversation controls. Drag sideways to spin; swipe down to hide." accessibilityState={{ busy: status === 'loading' }} onPressIn={() => scale.set(withTiming(reducedMotion ? 1 : .96, { duration: reducedMotion ? 0 : 120 }))} onPressOut={() => scale.set(withTiming(1, { duration: reducedMotion ? 0 : 140 }))} onPress={() => { feedback(); if (!reducedMotion) momentum.set(2.4); onPress(); }} style={[{ width: size, height: size, borderRadius: size / 2 }, style]}>
    <Svg pointerEvents="none" aria-hidden={true} width={size} height={size} viewBox="0 0 56 56" style={{position:'relative',zIndex:1}}>
      <Defs><RadialGradient id="orbSoftening"><Stop offset="0" stopColor={colors.background}/><Stop offset=".55" stopColor={colors.background}/><Stop offset="1" stopColor={colors.background} stopOpacity={0}/></RadialGradient><RadialGradient id="orbShadow"><Stop offset="0" stopColor={colors.ink} stopOpacity={.2} /><Stop offset=".65" stopColor={colors.ink} stopOpacity={.08} /><Stop offset="1" stopColor={colors.ink} stopOpacity={0} /></RadialGradient></Defs>
      <Aura animatedProps={auraProps}><Circle cx={28} cy={28} r={28} fill="url(#orbSoftening)"/><Circle cx={28} cy={30} r={28} fill="url(#orbShadow)" /></Aura>
      {([0, 1, 2] as const).map(index => <ParticleLayer key={index} index={index} paths={paths} activity={activity} ink={colors.ink} accent={colors.accent} />)}
    </Svg>
  </Control></GestureDetector>;
}
function ParticleLayer({ index, paths, activity, ink, accent }: { index: 0|1|2; paths: SharedValue<[string, string, string]>; activity: SharedValue<number>; ink: string; accent: string }) {
  const props = useAnimatedProps(() => ({ d: paths.get()[index], fill: interpolateColor(activity.get(), [0, 1], [ink, accent]) }));
  return <Layer animatedProps={props} opacity={[.3, .6, .95][index]} />;
}
