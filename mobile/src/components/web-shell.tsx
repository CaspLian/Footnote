import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Icon, IconName } from './icon';
import { HeaderActions } from './header-actions';
import { GlassCloseButton } from './sheet';
import { Txt, useDesktop } from './ui';
import { WebStyles } from './web-styles';
import { useTheme, radius, space } from '@/theme';
export function WebShell({children}:{children:ReactNode}){ const { colors } = useTheme();const desktop=useDesktop();const path=usePathname();const intro=path==='/welcome'||path==='/onboarding';if(!desktop)return <><WebStyles/>{children}</>;
return <View style={{flex:1,flexDirection:'row',backgroundColor:colors.background}}><WebStyles/>{!intro?<View style={{width:220,padding:space.xl,gap:space.xl,backgroundColor:colors.surface}}><Txt variant="title">Unfold</Txt><View style={{gap:space.sm}}>{([['Home','house','/'],['Bills','files','/bills'],['Timeline','calendar','/track'],['Guide','book','/guide'],['Family','family','/profiles']] as const).map(([title,icon,href])=><Pressable key={title} accessibilityRole="link" accessibilityState={{selected:path===href}} onPress={()=>router.navigate(href)} style={({pressed})=>({minHeight:48,padding:space.md,gap:space.md,flexDirection:'row',alignItems:'center',backgroundColor:path===href||pressed?colors.accentSoft:'transparent',borderRadius:radius.small})}><Icon name={icon as IconName} selected={path===href} color={colors.accent}/><Txt variant="label" accent>{title}</Txt></Pressable>)}</View><View style={{flex:1}}/><Txt variant="caption" muted>Private, on this device.</Txt></View>:null}<View style={{flex:1}}><View style={{paddingHorizontal:space.xxl,paddingTop:space.lg,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>{intro?<Txt variant="section">Unfold</Txt>:path==='/document'?<GlassCloseButton label="Close document" onPress={()=>router.canGoBack()?router.back():router.replace('/(tabs)/(home)')}/>:<Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={()=>router.canGoBack()?router.back():router.replace('/(tabs)/(home)')} style={{minHeight:48,minWidth:48,justifyContent:'center'}}><Icon name="back"/></Pressable>}<HeaderActions/></View>{children}</View></View>;
}
