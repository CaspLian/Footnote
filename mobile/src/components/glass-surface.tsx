import { View } from 'react-native';
import { useTheme } from '@/theme';
import type { GlassSurfaceProps } from './glass-surface-types';
export function useGlassAvailable() { return false; }
export function GlassSurface({ style, tinted }: GlassSurfaceProps) {
  const { colors } = useTheme();
  return <View pointerEvents="none" style={[style, { backgroundColor: tinted ? colors.accentSoft : colors.surface }]} />;
}
