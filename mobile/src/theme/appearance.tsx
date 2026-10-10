import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo, Appearance, Platform, useColorScheme } from 'react-native';
import { useUnfoldStore } from '@/store';
import { darkColors, darkGradients, gradients, lightColors, type Palette } from './palette';

const AppearanceContext = createContext<{ colors: Palette; gradients: { paper: readonly [string, string] }; scheme: 'light' | 'dark'; reducedMotion: boolean; reducedTransparency: boolean }>({
  colors: lightColors as Palette, gradients, scheme: 'light' as 'light' | 'dark',
  reducedMotion: false, reducedTransparency: false,
});
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const preference = useUnfoldStore(s => s.preferences.theme);
  const reduceMotion = useUnfoldStore(s => s.preferences.reduceMotion);
  const system = useColorScheme();
  const scheme = preference === 'system' ? system === 'dark' ? 'dark' : 'light' : preference;
  const [systemMotion, setSystemMotion] = useState(false);
  const [reducedTransparency, setReducedTransparency] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setSystemMotion);
    if (Platform.OS === 'ios') void AccessibilityInfo.isReduceTransparencyEnabled().then(setReducedTransparency);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemMotion);
    const transparency = Platform.OS === 'ios' ? AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReducedTransparency) : undefined;
    return () => { motion.remove(); transparency?.remove(); };
  }, []);
  useEffect(() => { if (Platform.OS !== 'web') Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference); }, [preference]);
  return <AppearanceContext.Provider value={{ colors: scheme === 'dark' ? darkColors : lightColors, gradients: scheme === 'dark' ? darkGradients : gradients, scheme, reducedMotion: systemMotion || reduceMotion, reducedTransparency }}>{children}</AppearanceContext.Provider>;
}
export const useTheme = () => useContext(AppearanceContext);
export const useMotionPreference = () => useTheme().reducedMotion;
