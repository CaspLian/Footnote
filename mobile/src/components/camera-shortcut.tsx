import { Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { cubicBezier } from 'react-native-reanimated';
import { useState } from 'react';
import { useFootnoteStore } from '@/store';
import { useTheme, shadows } from '@/theme';
import { GlassSurface, useGlassAvailable } from './glass-surface';
import { Icon } from './icon';
const Control = Animated.createAnimatedComponent(Pressable);
export function CameraShortcut({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const { colors, reducedMotion } = useTheme();
  const haptics = useFootnoteStore(s => s.preferences.haptics);
  const glass = useGlassAvailable();
  const [pressed, setPressed] = useState(false);
  return <View pointerEvents="box-none" style={{ width: '100%', alignItems: 'flex-end', paddingHorizontal: 24 }}><Control accessibilityRole="button" accessibilityLabel="Photograph a bill" accessibilityHint="Opens the camera. Add more pages, then confirm your documents before the review begins." accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} onPress={() => { if (Platform.OS !== 'web' && haptics) void Haptics.selectionAsync().catch(() => {}); onPress(); }} style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', boxShadow: glass ? 'none' : shadows.raised, transform: [{ scale: pressed && !reducedMotion ? .96 : 1 }], transitionProperty: 'transform', transitionDuration: 140, transitionTimingFunction: cubicBezier(.23, 1, .32, 1) }}><GlassSurface tinted style={[StyleSheet.absoluteFill,{borderRadius:32}]} /><Icon name="camera" color={colors.accent} size={28} /></Control></View>;
}
