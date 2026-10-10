import type { ReactNode } from 'react';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useTheme } from '@/theme';
/** Search chrome changes once per focus/cancel, never on each result keystroke. */
export function SearchTransition({ children, reveal = false }: { children: ReactNode; reveal?: boolean }) {
  const { reducedMotion } = useTheme();
  return <Animated.View layout={reducedMotion ? undefined : LinearTransition.duration(220).easing(Easing.bezier(.23, 1, .32, 1))} entering={!reducedMotion && reveal ? FadeIn.duration(180) : undefined} exiting={!reducedMotion && reveal ? FadeOut.duration(100) : undefined}>{children}</Animated.View>;
}
