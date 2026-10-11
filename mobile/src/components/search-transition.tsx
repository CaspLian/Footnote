import type { ReactNode } from 'react';
import { useMemo } from 'react';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useTheme } from '@/theme';
/** Search chrome changes once per focus/cancel, never on each result keystroke. */
export function SearchTransition({ children, reveal = false }: { children: ReactNode; reveal?: boolean }) {
  const { reducedMotion } = useTheme();
  const layout = useMemo(() => LinearTransition.duration(220).easing(Easing.bezier(.23, 1, .32, 1)), []);
  return <Animated.View collapsable={false} layout={reducedMotion ? undefined : layout} entering={!reducedMotion && reveal ? FadeIn.duration(180) : undefined} exiting={!reducedMotion && reveal ? FadeOut.duration(100) : undefined}>{children}</Animated.View>;
}
