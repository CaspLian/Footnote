import type { ReactNode } from 'react';
import { Host } from '@expo/ui';
export function SettingsPickerHost({ children, scheme, accent }: { children: ReactNode; scheme: 'light'|'dark'; accent: string }) {
  return <Host colorScheme={scheme} seedColor={accent} ignoreSafeArea="all" style={{ width: 152, height: 48 }}>{children}</Host>;
}
