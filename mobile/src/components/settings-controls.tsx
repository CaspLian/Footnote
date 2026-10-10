import { createElement, ReactNode } from 'react';
import { Picker } from '@expo/ui';
import { SettingsPickerHost } from './settings-picker-host';
import { Platform, Pressable, Switch, View } from 'react-native';
import { Icon, IconName } from './icon';
import { Divider, Group, Txt } from './ui';
import { fonts, radius, space, useTheme } from '@/theme';

export function SettingsGroup({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  const { colors } = useTheme();
  return <Group gap={space.md}><Txt variant="heading" accessibilityRole="header">{title}</Txt><View style={{ backgroundColor: colors.surface, borderRadius: radius.card, overflow: 'hidden' }}>{children}</View>{note ? <Txt variant="caption" muted style={{ paddingHorizontal: space.sm }}>{note}</Txt> : null}</Group>;
}
export function SettingsLink({ title, detail, icon, leading, onPress, disabled, danger }: { title: string; detail?: string; icon?: IconName; leading?: ReactNode; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={detail ? `${title}, ${detail}` : title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ padding: space.lg, minHeight: 60, gap: space.md, flexDirection: 'row', alignItems: 'center', backgroundColor: pressed ? colors.accentSoft : 'transparent', opacity: disabled ? .45 : 1 })}>
    {leading ?? (icon ? <Icon name={icon} size={22} color={danger ? colors.error : colors.accent} /> : null)}
    <Group gap={space.xs} style={{ flex: 1 }}><Txt variant="label" style={danger ? { color: colors.error } : undefined}>{title}</Txt>{detail ? <Txt variant="caption" muted>{detail}</Txt> : null}</Group><Icon name="next" size={18} color={colors.muted} />
  </Pressable>;
}
export function SettingsPicker<T extends string | number>({ title, value, options, onChange }: { title: string; value: T; options: readonly { label: string; value: T }[]; onChange: (value: T) => void }) {
  const { scheme, colors } = useTheme();
  const picker = <Picker selectedValue={value} onValueChange={onChange} testID={title}>{options.map(option => <Picker.Item key={option.value} value={option.value} label={option.label} />)}</Picker>;
  return <View style={{ padding: space.lg, minHeight: 64, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md }}>
    <Txt variant="label" style={{ flexGrow: 1, flexShrink: 1, minWidth: 100 }}>{title}</Txt>
    {Platform.OS === 'web' ? createElement('select', { 'aria-label': title, value, onChange: (event: { target: { value: string } }) => { const option = options.find(o => String(o.value) === event.target.value); if (option) onChange(option.value); }, style: { minHeight: 48, padding: '8px 12px', borderRadius: radius.small, color: colors.accent, background: colors.accentSoft, border: 0, fontFamily: fonts.medium, fontSize: 14, width: 152, flexShrink: 0, textAlign: 'center', maxWidth: '100%', colorScheme: scheme } }, options.map(option => createElement('option', { key: option.value, value: option.value }, option.label))) : <SettingsPickerHost scheme={scheme} accent={colors.accent}>{picker}</SettingsPickerHost>}
  </View>;
}
export function SettingsToggle({ title, detail, value, onChange, disabled }: { title: string; detail?: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return <View style={{ padding: space.lg, minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
    <Group gap={space.xs} style={{ flex: 1 }}><Txt variant="label">{title}</Txt>{detail ? <Txt variant="caption" muted>{detail}</Txt> : null}</Group>
    <Switch accessibilityLabel={title} value={value} onValueChange={onChange} disabled={disabled} testID={title} trackColor={{ false: colors.line, true: colors.accent }} ios_backgroundColor={colors.line} />
  </View>;
}
export function SettingsDivider() { return <View style={{ paddingHorizontal: space.lg }}><Divider /></View>; }
