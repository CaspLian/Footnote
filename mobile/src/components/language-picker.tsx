import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { languageOption, type WorkingLanguage } from '@/domain/languages';
import { radius, space, useTheme } from '@/theme';
import { Group, Txt } from './ui';
import { Icon } from './icon';
import { flagAssets } from './flag-assets';
export function LanguagePicker({ value }: { value: WorkingLanguage }) {
  const { colors } = useTheme(); const current = languageOption(value);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Working language, ${current.name}`} onPress={() => router.push('/languages')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg, borderRadius: radius.control, borderWidth: 1, borderColor: colors.accent + '55', backgroundColor: pressed ? colors.accentSoft : colors.surface, minHeight: 76 })}><LanguageFlag country={current.country} /><Group style={{ flex: 1 }} gap={space.xs}><Txt variant="item">{current.native}</Txt><Txt variant="caption" muted>{current.name}</Txt></Group><Icon name="next" color={colors.accent} /></Pressable>;
}
export function LanguageFlag({ country }: { country: string }) { return <View accessible={false} style={{ width: 36, height: 26, borderRadius: 5, overflow: 'hidden' }}><Image source={flagAssets[country]} contentFit="cover" style={{ width: 36, height: 26 }} /></View>; }
