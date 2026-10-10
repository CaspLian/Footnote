import { View } from 'react-native';
import { usePathname } from 'expo-router';
import { IconButton, useLanguage } from './ui';
import { openProfiles, openSettings } from './navigation';

export function HeaderActions() {
  const { copy } = useLanguage();
  const path = usePathname();
  if (!['/', '/bills', '/guide', '/track'].includes(path)) return null;
  return <View style={{ flexDirection: 'row', gap: 8 }}><IconButton plain name="profile" label="Family profiles" onPress={openProfiles} /><IconButton plain name="settings" label={copy('Settings','Ajustes')} onPress={openSettings} /></View>;
}
