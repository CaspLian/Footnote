import { Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useFootnoteStore } from '@/store';
import { languageOption, workingLanguages, type WorkingLanguage } from '@/domain/languages';
import { radius, space, useTheme } from '@/theme';
import { Group, Txt } from './ui';
import { Icon } from './icon';
import { flagAssets } from './flag-assets';
export function LanguagePicker({ value }: { value: WorkingLanguage }) {
  const { colors } = useTheme(); const current = languageOption(value);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Working language, ${current.name}`} onPress={() => router.push('/languages')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg, borderRadius: radius.control, borderWidth: 1, borderColor: colors.accent + '55', backgroundColor: pressed ? colors.accentSoft : colors.surface, minHeight: 76 })}><LanguageFlag country={current.country} /><Group style={{ flex: 1 }} gap={space.xs}><Txt variant="item">{current.native}</Txt><Txt variant="caption" muted>{current.name}</Txt></Group><Icon name="next" color={colors.accent} /></Pressable>;
}
export function LanguageGrid({ value, onChange }: { value?: WorkingLanguage; onChange: (value: WorkingLanguage) => void }) {
  const { colors } = useTheme();
  return <View accessibilityLabel="Choose your working language" style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md, marginHorizontal: -5 }}>
    {workingLanguages.map(language => {
      const selected = value === language.code;
      return <View key={language.code} style={{ width: '50%', paddingHorizontal: 5 }}><Pressable
        accessibilityRole="radio" aria-checked={selected} accessibilityLabel={`${language.name}, ${language.native}`} accessibilityState={{ checked: selected }}
        onPress={() => {
          if (Platform.OS !== 'web' && useFootnoteStore.getState().preferences.haptics) {
            void Haptics.selectionAsync().catch(() => {});
          }
          onChange(language.code);
        }}
        style={({ pressed }) => ({ height: 76, paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: radius.control, borderWidth: 1.5, borderColor: selected ? colors.accent : colors.line, backgroundColor: selected || pressed ? colors.accentSoft : colors.surface, flexDirection: 'row', alignItems: 'center', gap: space.sm })}>
        <LanguageFlag country={language.country} size="compact" />
        <Group gap={2} style={{ flex: 1, minWidth: 0 }}><Txt variant="label" accent={selected} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3} style={{ fontSize: 16, lineHeight: 21 }}>{language.native}</Txt>{language.name !== language.native ? <Txt variant="caption" muted numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>{language.name.split(' · ')[0]}</Txt> : null}</Group>
      </Pressable></View>;
    })}
  </View>;
}
export function LanguageFlag({ country, size = 'regular' }: { country: string; size?: 'regular' | 'compact' }) {
  const width = size === 'compact' ? 26 : 36; const height = size === 'compact' ? 19 : 26;
  return <View accessible={false} style={{ width, height, borderRadius: size === 'compact' ? 4 : 5, overflow: 'hidden', flexShrink: 0 }}><Image source={flagAssets[country]} contentFit="cover" style={{ width, height }} /></View>;
}
