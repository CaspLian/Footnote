import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Linking, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFootnoteStore } from '@/store';
import { deleteAttachment, importDocument } from '@/native';
import { ImportController } from '@/native/import-controller';
import { Button, Feedback, Group, Txt } from './ui';
import { FootnoteLoader } from './loader';
import { space, useTheme } from '@/theme';

export function useDocumentImport() {
  const controller = useMemo(() => new ImportController({
    pick: importDocument,
    paint: () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    commit: (attachment, caseId, additional = []) => useFootnoteStore.getState().addImportedBatch([attachment, ...additional], caseId),
    discard: deleteAttachment,
    advance: caseId => router.navigate({ pathname: '/confirm-documents', params: { caseId } }),
  }), []);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => () => controller.cancel(), [controller]);
  const run = (source: Parameters<typeof controller.run>[0], kind: Parameters<typeof controller.run>[1] = 'auto', caseId?: string) => {
    if (source === 'camera' && Platform.OS !== 'web') {
      router.navigate({ pathname: '/camera', params: { kind, ...(caseId ? { caseId } : {}) } });
      return Promise.resolve();
    }
    return controller.run(source, kind, caseId);
  };
  return { ...snapshot, busy: snapshot.phase !== 'idle', run, cancel: controller.cancel };
}
export function DocumentImportProgress({ flow }: { flow: ReturnType<typeof useDocumentImport> }) {
  const { colors } = useTheme();
  // An in-place overlay avoids presenting/dismissing another native controller while a picker closes.
  if (flow.phase !== 'preparing') return null;
  return <View accessibilityViewIsModal style={{ position: 'absolute', inset: 0, zIndex: 100, backgroundColor: colors.background }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: space.screen }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Group gap={space.screen} style={{ width: '100%', maxWidth: 440 }}>
        <FootnoteLoader title="Preparing your document" detail="Saving the selected files on this device." />
        <Txt variant="label" muted numberOfLines={2} style={{ textAlign: 'center' }}>{flow.filename}</Txt>
        <Txt variant="caption" muted style={{ textAlign: 'center' }}>You’ll confirm your documents before review.</Txt>
      </Group></View>
      <Button title="Cancel import" variant="secondary" onPress={flow.cancel} />
    </SafeAreaView>
  </View>;
}
export function DocumentImportError({ flow }: { flow: ReturnType<typeof useDocumentImport> }) {
  return flow.error ? <Feedback danger text={flow.error} action={flow.denied ? { title: 'Open device settings', onPress: () => { void Linking.openSettings(); } } : undefined} /> : null;
}
