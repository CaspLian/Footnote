import { Alert, Platform } from 'react-native';
import { translateText } from '@/localization/translate';
import { useFootnoteStore } from '@/store';

export function confirmAction(title: string, message: string, action: string, onConfirm: () => void, destructive = false) {
  const t = (text: string) => translateText(text, useFootnoteStore.getState().preferences.workingLanguage);
  title = t(title); message = t(message); action = t(action);
  if (Platform.OS === 'web') { if (globalThis.confirm(`${title}\n\n${message}`)) onConfirm(); return; }
  Alert.alert(title, message, [{ text: t('Cancel'), style: 'cancel' }, { text: action, style: destructive ? 'destructive' : 'default', onPress: onConfirm }]);
}
