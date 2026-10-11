import { useEffect, useState } from 'react';
import { Platform, Pressable } from 'react-native';
import { router, Stack } from 'expo-router';
import { languageOption, workingLanguages } from '@/domain/languages';
import { useFootnoteStore } from '@/store';
import { radius, space, useTheme } from '@/theme';
import { Button, Feedback, Group, Screen, Txt } from '@/components/ui';
import { backendConfigured, backendLocale, supportedLanguages } from '@/services/backend';
import { LanguageFlag } from '@/components/language-picker';
import { SearchControl } from '@/components/search-control';
import { SearchTransition } from '@/components/search-transition';
import { Icon } from '@/components/icon';
import { GlassCloseButton } from '@/components/sheet';
import { toolbarIcons } from '@/components/toolbar-icons';
export function Languages() {
  const { colors } = useTheme(); const value = useFootnoteStore(s => s.preferences.workingLanguage); const current = languageOption(value);
  const [search,setSearch]=useState(''); const [focused,setFocused]=useState(false); const searching=focused||!!search.trim();
  const [available, setAvailable] = useState<Record<string, string>>();
  const [connectionError, setConnectionError] = useState('');
  useEffect(() => { if (!backendConfigured()) return; const abort = new AbortController(); void supportedLanguages(abort.signal).then(languages => { if (!abort.signal.aborted) setAvailable(languages); }).catch(() => { if (!abort.signal.aborted) setConnectionError('The backend language list could not be checked. Your selection is still saved on this device.'); }); return () => abort.abort(); }, []);
  const options=workingLanguages.filter(l=>`${l.name} ${l.native}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const close=()=>router.canGoBack()?router.back():router.replace('/settings');
  return <><Stack.Screen options={{ title:'Working language', headerShown:Platform.OS==='ios'||!searching, headerLeft:()=>null, headerRight:Platform.OS==='ios'?undefined:()=>searching?null:<GlassCloseButton onPress={close} label="Close language selection"/> }} />{Platform.OS==='ios'?<Stack.Toolbar placement="right"><Stack.Toolbar.Button icon={toolbarIcons.close} accessibilityLabel="Close language selection" tintColor={colors.ink} iconRenderingMode="template" onPress={close}>Close</Stack.Toolbar.Button></Stack.Toolbar>:null}
    <Screen contentWidth={720} testID="language-selection" searchMode={searching} footer={<Button title={`Use ${current.native}`} onPress={close}/>}>
      <SearchControl label="Search languages" placeholder="Language or native name" value={search} onChange={setSearch} active={searching} onActiveChange={setFocused}/>
      {!searching?<SearchTransition reveal><Txt muted>Choose the language for document explanations and your voice agent. App screens are in English.</Txt></SearchTransition>:null}
      <SearchTransition><Group gap={space.sm}>{options.map(l=><Pressable key={l.code} accessibilityRole="radio" aria-checked={l.code===value} accessibilityLabel={l.name} accessibilityState={{checked:l.code===value}} onPress={()=>useFootnoteStore.getState().setPreferences({workingLanguage:l.code})} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:space.lg,padding:space.lg,borderRadius:radius.small,minHeight:76,backgroundColor:l.code===value||pressed?colors.accentSoft:'transparent'})}><LanguageFlag country={l.country}/><Group style={{flex:1}} gap={space.xs}><Txt variant="item" style={{fontSize:20,lineHeight:27}}>{l.native}</Txt>{l.name!==l.native?<Txt variant="body" muted style={{fontSize:15,lineHeight:22}}>{l.name}</Txt>:null}</Group>{l.code===value?<Icon name="check" color={colors.accent}/>:null}</Pressable>)}</Group></SearchTransition>
      {!options.length?<Txt muted>No language matches. Try its English or native name.</Txt>:null}
      {connectionError ? <Feedback text={connectionError} /> : available && !(backendLocale(value) in available) ? <Feedback text="This server does not support the selected language yet. Update the backend or choose another language before analyzing." /> : null}
    </Screen></>;
}
