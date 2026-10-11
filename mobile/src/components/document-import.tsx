import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Linking, Modal, View } from 'react-native';
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
  return { ...snapshot, busy: snapshot.phase !== 'idle', run: controller.run.bind(controller), cancel: controller.cancel };
}
export function DocumentImportProgress({ flow }: { flow: ReturnType<typeof useDocumentImport> }) {
  const { colors, reducedMotion } = useTheme();
  return <Modal visible={flow.phase === 'preparing'} animationType={reducedMotion ? 'none' : 'fade'} presentationStyle="fullScreen" onRequestClose={flow.cancel}>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: space.screen }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Group gap={space.screen} style={{ width: '100%', maxWidth: 440 }}>
        <FootnoteLoader title="Preparing your document" detail="Saving a private copy and getting it ready for your review." />
        <Txt variant="label" muted numberOfLines={2} style={{ textAlign: 'center' }}>{flow.filename}</Txt>
        <Txt variant="caption" muted style={{ textAlign: 'center' }}>Next, confirm the documents you want to use. A bill, an EOB, or both can help.</Txt>
      </Group></View>
      <Button title="Cancel import" variant="secondary" onPress={flow.cancel} />
    </SafeAreaView>
  </Modal>;
}
export function DocumentImportError({ flow }: { flow: ReturnType<typeof useDocumentImport> }) {
  return flow.error ? <Feedback danger text={flow.error} action={flow.denied ? { title: 'Open device settings', onPress: () => { void Linking.openSettings(); } } : undefined} /> : null;
}
