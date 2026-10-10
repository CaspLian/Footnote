import { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, space } from '@/theme';
import { GlassSurface } from './glass-surface';
import { Icon } from './icon';
import { Txt } from './ui';
import { SoftScrollView } from './soft-scroll';

export function GlassCloseButton({ onPress, label = 'Close sheet' }: { onPress: () => void; label?: string }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
    <GlassSurface style={[StyleSheet.absoluteFill, { borderRadius: 24 }]} /><Icon name="close" size={22} color={colors.ink} />
  </Pressable>;
}
export function AppSheet({ visible, title, onClose, children, footer }: { visible: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const { colors, reducedMotion } = useTheme();
  return <Modal visible={visible} onRequestClose={onClose} presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'} transparent={Platform.OS !== 'ios'} animationType={reducedMotion ? 'none' : Platform.OS === 'ios' ? 'slide' : 'fade'}>
    <SafeAreaProvider><SheetContent title={title} onClose={onClose} footer={footer} colors={colors}>{children}</SheetContent></SafeAreaProvider>
  </Modal>;
}
function SheetContent({ title, onClose, footer, children, colors }: { title: string; onClose: () => void; footer?: ReactNode; children: ReactNode; colors: ReturnType<typeof useTheme>['colors'] }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const browser = Platform.OS === 'web';
  return <View style={{ flex: 1, backgroundColor: browser ? 'rgba(10,24,20,.38)' : colors.background, justifyContent: browser ? 'center' : undefined, alignItems: browser ? 'center' : undefined, padding: browser ? space.screen : 0 }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} role={browser ? 'dialog' : undefined} aria-modal={browser ? true : undefined} aria-label={title} accessibilityViewIsModal style={{ flex: browser ? undefined : 1, maxHeight: browser ? height * .9 : undefined, width: '100%', maxWidth: browser ? 560 : undefined, backgroundColor: colors.background, borderRadius: browser ? 24 : 0, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.screen, paddingTop: Math.max(insets.top, space.lg), paddingBottom: space.lg }}>
        <Txt variant="section" accessibilityRole="header" style={{ flex: 1 }}>{title}</Txt><GlassCloseButton onPress={onClose} label={`Close ${title.toLowerCase()}`} />
      </View>
      <SoftScrollView style={{ flex: browser ? undefined : 1, flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: space.screen, paddingBottom: space.screen, gap: space.lg }} keyboardShouldPersistTaps="handled">{children}</SoftScrollView>
      {footer ? <View style={{ paddingHorizontal: space.screen, paddingTop: space.md, paddingBottom: Math.max(insets.bottom, space.screen) }}>{footer}</View> : null}
    </KeyboardAvoidingView>
  </View>;
}
