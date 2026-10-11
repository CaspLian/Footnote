import { View } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';
import { useMotionPreference, useTheme, radius, shadows, space } from '@/theme';
import { Txt } from './ui';

/** Folded paper is the brand's state indicator; no artificial percentage is shown. */
export function UnfoldLoader({ title = 'Opening your workspace', detail = 'A little clarity is on its way.', compact = false, settled = false }: { title?: string; detail?: string; compact?: boolean; settled?: boolean }) { const { colors } = useTheme();
  const reduced = useMotionPreference() || settled;
  return <View accessibilityRole={settled ? 'text' : 'progressbar'} accessibilityLabel={title} accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: space.screen, paddingVertical: compact ? space.screen : space.xxl }}>
    <View accessible={false} style={{ width: 96, height: 104, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: 64, height: 84, borderRadius: radius.small, backgroundColor: colors.accentSoft, transform: [{ rotate: '-12deg' }], ...(reduced ? {} : { animationName: { '0%, 100%': { transform: [{ translateX: -5 }, { rotate: '-12deg' }] }, '50%': { transform: [{ translateX: 4 }, { rotate: '-4deg' }] } }, animationDuration: '1800ms', animationIterationCount: 'infinite', animationTimingFunction: cubicBezier(.77,0,.175,1) }) }} />
      <Animated.View style={{ width: 64, height: 84, padding: 14, gap: 9, borderRadius: radius.small, backgroundColor: colors.surface, boxShadow: shadows.paper, ...(reduced ? {} : { animationName: { '0%, 100%': { transform: [{ translateY: 0 }, { rotate: '4deg' }] }, '50%': { transform: [{ translateY: -8 }, { rotate: '0deg' }] } }, animationDuration: '1800ms', animationIterationCount: 'infinite', animationTimingFunction: cubicBezier(.77,0,.175,1) }) }}>
        <View style={{ width: 16, height: 4, borderRadius: 2, backgroundColor: colors.accent }} />
        {[32,36,24].map((width,index)=><View key={index} style={{ width, height: 3, borderRadius: 2, backgroundColor: colors.line }} />)}
        <View style={{ position: 'absolute', right: 0, top: 0, width: 18, height: 18, borderBottomLeftRadius: 7, backgroundColor: colors.accentSoft }} />
      </Animated.View>
    </View>
    <View style={{ gap: space.sm, alignItems: 'center', maxWidth: 320 }}><Txt variant={compact?'section':'title'} style={{ textAlign: 'center' }}>{title}</Txt><Txt muted style={{ textAlign: 'center' }}>{detail}</Txt></View>
  </View>;
}
