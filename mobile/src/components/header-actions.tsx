import { View } from 'react-native';
import { router } from 'expo-router';
import { IconButton, useLanguage } from './ui';

export function HeaderActions() {
  const { copy } = useLanguage();
  return <View style={{ flexDirection: 'row' }}><IconButton name="profile" label="Family profiles" onPress={() => router.push('/profiles')} /><IconButton name="settings" label={copy('Settings','Ajustes')} onPress={() => router.push('/settings')} /></View>;
}
