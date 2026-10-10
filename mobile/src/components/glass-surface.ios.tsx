import { View } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '@/theme';
import type { GlassSurfaceProps } from './glass-surface-types';
export function useGlassAvailable() {
  const { reducedTransparency } = useTheme();
  return !reducedTransparency && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
}
export function GlassSurface({ style, tinted }: GlassSurfaceProps) {
  const { colors, scheme } = useTheme();
  const available = useGlassAvailable();
  if (!available) return <View pointerEvents="none" style={[style, { backgroundColor: tinted ? colors.accentSoft : colors.surface }]} />;
  return <GlassView pointerEvents="none" isInteractive glassEffectStyle="regular" colorScheme={scheme} tintColor={tinted ? scheme === 'dark' ? '#325C4C' : '#BADCCD' : undefined} style={style} />;
}
