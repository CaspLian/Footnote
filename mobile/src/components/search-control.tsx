import { Platform, Pressable, TextInput, View } from 'react-native';
import { useCallback, useEffect, useRef } from 'react';
import type { SearchBarCommands } from 'react-native-screens';
import { Stack, useFocusEffect } from 'expo-router';
import { useSearchMode } from './search-mode';
import { SearchTransition } from './search-transition';
import { Txt } from './ui';
import { Icon } from './icon';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, space, type, useTheme } from '@/theme';
interface SearchProps { value: string; onChange: (text: string) => void; placeholder: string; label: string; active: boolean; softenBelow?: boolean; onActiveChange: (active: boolean) => void; }
export function SearchControl({ value, onChange, placeholder, label, active, onActiveChange, softenBelow = false }: SearchProps) {
  const { colors } = useTheme();
  const ref = useRef<SearchBarCommands | null>(null);
  const input = useRef<TextInput>(null);
  const { setActive } = useSearchMode();
  useFocusEffect(useCallback(() => { setActive(active); return () => setActive(false); }, [active, setActive]));
  const cancel = () => { onChange(''); onActiveChange(false); input.current?.blur(); };
  useEffect(() => { if (!value && Platform.OS === 'ios') ref.current?.clearText(); }, [value]);
  if (Platform.OS === 'ios') return <Stack.SearchBar ref={ref} placeholder={placeholder} autoCapitalize="none" hideWhenScrolling={false} hideNavigationBar obscureBackground={false} placement="stacked" textColor={colors.ink} tintColor={colors.accent} onChangeText={event => onChange(event.nativeEvent.text)} onFocus={() => onActiveChange(true)} onCancelButtonPress={cancel} />;
  return <SearchTransition><View><View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.control, borderWidth:1,borderColor:active?colors.accent:colors.line, paddingHorizontal: space.lg, minHeight: 56 }}>
    <Icon name="search" color={colors.muted} size={20} />
    <TextInput ref={input} onFocus={() => onActiveChange(true)} accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={colors.muted} value={value} onChangeText={onChange} autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={[type.body, { flex: 1, minWidth: 0, paddingVertical: space.md, color: colors.ink, outlineWidth:0 }]} />
    {active ? <Pressable accessibilityRole="button" accessibilityLabel="Cancel search" onPress={cancel} style={{ minHeight: 48, justifyContent: 'center' }}><Txt variant="label" accent>Cancel</Txt></Pressable> : null}
    {value ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChange('')} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={20} /></Pressable> : null}
  </View>{softenBelow?<LinearGradient pointerEvents="none" colors={[colors.background,`${colors.background}00`]} style={{position:'absolute',top:56,left:0,right:0,height:16,zIndex:1}}/>:null}</View></SearchTransition>;
}
