import { TextStyle } from 'react-native';
import { colors, gradients } from './palette';

export { lightColors, darkColors, colors, gradients, darkGradients, type Palette } from './palette';
export const space = { xs: 4, sm: 8, md: 12, lg: 16, screen: 24, xl: 32, xxl: 48 } as const;
export const radius = { small: 12, control: 16, card: 20 } as const;
export const sizes = { touch: 48, button: 56, icon: 24, featureIcon: 40, header: 56, preview: 360, draft: 300 } as const;
export const motion = { press: 140, transition: 240, disclosure: 220 } as const;
export const shadows = { paper: '0 8px 24px rgba(25,45,42,0.08)', raised: '0 16px 40px rgba(25,45,42,0.12)', control: '0 3px 8px rgba(23,107,91,0.14)' } as const;
export const fonts = { regular: 'Geist_400Regular', medium: 'Geist_500Medium', semibold: 'Geist_600SemiBold', bold: 'Geist_700Bold' } as const;
export const type = {
  display: { fontFamily: fonts.semibold, fontSize: 36, lineHeight: 42, letterSpacing: -.8 },
  title: { fontFamily: fonts.semibold, fontSize: 28, lineHeight: 34, letterSpacing: -.4 },
  section: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26 },
  heading: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 30, letterSpacing: -.25 },
  item: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 25 },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
} satisfies Record<string, TextStyle>;
export const theme = { colors, space, radius, sizes, motion, fonts, type, shadows, gradients };
export { AppearanceProvider, useTheme, useMotionPreference } from './appearance';
