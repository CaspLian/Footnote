import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { HeaderActions } from '@/components/header-actions';
import { Icon } from '@/components/icon';
import { useLanguage, useDesktop } from '@/components/ui';
import { colors, fonts, sizes, space, type } from '@/theme';

export default function TabsLayout() {
  const desktop=useDesktop();
  const { copy } = useLanguage();
  return <Tabs screenOptions={{ animation: 'none', headerShown: false, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted, tabBarStyle: { display:desktop?'none':'flex', backgroundColor: colors.surface, borderTopColor: colors.line, ...(Platform.OS==='web'?{height:64,paddingBottom:space.sm}:null) }, tabBarItemStyle: { minHeight: sizes.touch, paddingTop: space.xs }, tabBarLabelStyle: { fontFamily: fonts.regular, fontSize: type.caption.fontSize } }}>
    <Tabs.Screen name="(home)" options={{ title: copy('Home','Inicio'), tabBarIcon: ({ focused }) => <Icon name="house" selected={focused} color={focused?colors.accent:colors.muted} /> }} />
    <Tabs.Screen name="bills" options={{ title: copy('Bills','Facturas'), tabBarIcon: ({ focused }) => <Icon name="files" selected={focused} color={focused?colors.accent:colors.muted} /> }} />
    <Tabs.Screen name="track" options={{ title: copy('Timeline','Línea de tiempo'), tabBarIcon: ({ focused }) => <Icon name="calendar" selected={focused} color={focused?colors.accent:colors.muted} /> }} />
    <Tabs.Screen name="guide" options={{ title: copy('Guide','Guía'), tabBarIcon: ({ focused }) => <Icon name="book" selected={focused} color={focused?colors.accent:colors.muted} /> }} />
  </Tabs>;
}
