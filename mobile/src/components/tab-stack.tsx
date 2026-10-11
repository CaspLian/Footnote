import { Platform, View } from 'react-native';
import { useMemo, useState } from 'react';
import { Stack } from 'expo-router';
import { HeaderActions } from './header-actions';
import { useDesktop } from './ui';
import { openProfiles, openSettings } from './navigation';
import { fonts, type, useTheme } from '@/theme';
import { toolbarIcons } from './toolbar-icons';
import { HeaderBrand } from './header-brand';
import { SearchModeContext } from './search-mode';
export function TabStack({ title }: { title: string }) {
  const desktop = useDesktop();
  const { colors } = useTheme();
  const [active, setActive] = useState(false);
  const searchMode = useMemo(() => ({ active, setActive }), [active]);
  return <SearchModeContext.Provider value={searchMode}><Stack screenOptions={{ headerShown: !desktop && (Platform.OS === 'ios' || !active), contentStyle: { backgroundColor: colors.background }, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.ink, headerShadowVisible: false, scrollEdgeEffects: { top: 'hidden' }, headerTitleAlign: 'left', headerTitleStyle: { fontFamily: fonts.semibold, fontSize: type.section.fontSize }, headerRight: Platform.OS === 'ios' ? undefined : () => active ? null : <HeaderActions /> }}>
    <Stack.Screen name="index" options={{ title: active ? '' : title, headerBackVisible: false, ...(Platform.OS !== 'ios' ? { headerLeft: () => null } : {}), headerTitle: Platform.OS === 'ios' ? '' : () => <HeaderBrand section={title === 'Footnote' ? undefined : title} /> }}>
      {Platform.OS === 'ios' ? <Stack.Toolbar placement="left"><Stack.Toolbar.View hidesSharedBackground><View style={{ paddingLeft: 8 }}><HeaderBrand section={title === 'Footnote' ? undefined : title} /></View></Stack.Toolbar.View></Stack.Toolbar> : null}
      {Platform.OS === 'ios' ? <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon={toolbarIcons.profile} iconRenderingMode="template" tintColor={colors.ink} accessibilityLabel="Family profiles" onPress={openProfiles}>Family profiles</Stack.Toolbar.Button>
        <Stack.Toolbar.Button icon={toolbarIcons.settings} iconRenderingMode="template" tintColor={colors.ink} accessibilityLabel="Settings" onPress={openSettings}>Settings</Stack.Toolbar.Button>
      </Stack.Toolbar> : null}
    </Stack.Screen>
  </Stack></SearchModeContext.Provider>;
}
