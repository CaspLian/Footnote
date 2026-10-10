import { View, type ScrollViewProps } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme';
import { scrollEdgeOpacity } from '@/domain/scroll-edges';

/** App-owned scroll regions; edge overlays never intercept input or cover fixed controls. */
export function SoftScrollView({ style, children, onContentSizeChange, onLayout, topFadeHeight = 24, bottomFadeHeight = 28, softenTopAtRest = false, ...props }: Omit<ScrollViewProps, 'onScroll'> & { topFadeHeight?: number; bottomFadeHeight?: number; softenTopAtRest?: boolean }) {
  const { colors } = useTheme();
  const offset = useSharedValue(0), content = useSharedValue(0), viewport = useSharedValue(0);
  const topInset = useSharedValue(0), bottomInset = useSharedValue(0);
  const scroll = useAnimatedScrollHandler(event => {
    offset.set(event.contentOffset.y);
    content.set(event.contentSize.height);
    viewport.set(event.layoutMeasurement.height);
    topInset.set(event.contentInset?.top ?? 0);
    bottomInset.set(event.contentInset?.bottom ?? 0);
  });
  const top = useAnimatedStyle(() => ({ opacity: softenTopAtRest ? 1 : scrollEdgeOpacity(offset.get(), content.get(), viewport.get(), topInset.get(), bottomInset.get()).top }));
  const bottom = useAnimatedStyle(() => ({ opacity: scrollEdgeOpacity(offset.get(), content.get(), viewport.get(), topInset.get(), bottomInset.get()).bottom }));
  return <View style={[{ flex: 1, minHeight: 0 }, style]}>
    <Animated.ScrollView {...props} style={{ flex: 1 }} scrollEventThrottle={16} onScroll={scroll}
      onContentSizeChange={(width, height) => { content.set(height); onContentSizeChange?.(width, height); }}
      onLayout={event => { viewport.set(event.nativeEvent.layout.height); onLayout?.(event); }}>{children}</Animated.ScrollView>
    <Animated.View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: topFadeHeight }, top]}><LinearGradient colors={[colors.background, `${colors.background}00`]} style={{ flex: 1 }} /></Animated.View>
    <Animated.View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={[{ position: 'absolute', bottom: 0, left: 0, right: 0, height: bottomFadeHeight }, bottom]}><LinearGradient colors={[`${colors.background}00`, colors.background]} style={{ flex: 1 }} /></Animated.View>
  </View>;
}
