export const lightColors = {
  background: '#F5F2EB', surface: '#FFFEFA', ink: '#192D2A', muted: '#5E6B65',
  accent: '#176B5B', accentSoft: '#E8F0E9', line: '#DDDCD4',
  warning: '#8A5B22', warningSoft: '#F7F0E3', error: '#A13F35', errorSoft: '#F9EEEB',
  info: '#315C99', infoSoft: '#EAF0FB', success: '#306849', successSoft: '#E9F3EA', draft: '#76528D', draftSoft: '#F1EBF7',
} as const;
export type Palette = { [K in keyof typeof lightColors]: string };
export const darkColors: Palette = {
  background: '#111C1A', surface: '#1C2A27', ink: '#F2F1E8', muted: '#ABBDB5',
  accent: '#91D7BF', accentSoft: '#243F35', line: '#3D5049',
  warning: '#EBC58E', warningSoft: '#3C3021', error: '#F5B0A4', errorSoft: '#3D2523',
  info: '#AAC8F8', infoSoft: '#24344D', success: '#A2D3AE', successSoft: '#243C2C', draft: '#D3B8EC', draftSoft: '#382B45',
};
export const colors = lightColors;
export const gradients = { paper: ['#E0EDE4', '#F5EEDC'] as const };
export const darkGradients = { paper: ['#213E32', '#303627'] as const };
