import type { ReactNode } from 'react';
import { Host } from '@expo/ui/swift-ui';
import { frame, tint } from '@expo/ui/swift-ui/modifiers';
export function SettingsPickerHost({ children, scheme, accent }: { children: ReactNode; scheme: 'light'|'dark'; accent: string }) {
  return <Host colorScheme={scheme} ignoreSafeArea="all" style={{ width: 152, height: 48 }} modifiers={[frame({ width: 152, height: 48, alignment: 'trailing' }), tint(accent)]}>{children}</Host>;
}
