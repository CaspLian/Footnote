import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import type { DocumentKind } from '@/domain';
import { deleteAttachment, persistImportedAttachment } from '@/native';
import { Button, Feedback, Group, Screen, Txt, useLanguage } from '@/components/ui';
import { useUnfoldStore } from '@/store';
import { space, useTheme } from '@/theme';

export function CameraCapture() {
  const { copy } = useLanguage();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ caseId?: string; kind?: string }>();
  const kind: DocumentKind = params.kind === 'bill' || params.kind === 'eob' || params.kind === 'policy' ? params.kind : 'auto';
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [captured, setCaptured] = useState<CameraCapturedPicture[]>([]);
  const [preview, setPreview] = useState<CameraCapturedPicture | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const permissionStatus = permission?.status;
  const canAskAgain = permission?.canAskAgain;
  useEffect(() => {
    if (permissionStatus && permissionStatus !== 'granted' && canAskAgain) void requestPermission();
  }, [permissionStatus, canAskAgain, requestPermission]);

  async function capture() {
    if (!ready || !camera.current || busy) return;
    if (captured.length >= 10) {
      setError(copy('A scan can include up to 10 pages.','El escaneo admite hasta 10 páginas.'));
      return;
    }
    setError('');
    try {
      setPreview(await camera.current.takePictureAsync({ quality: 1 }));
    } catch {
      setError(copy('The photo could not be captured. Try again.','No se pudo tomar la foto. Inténtalo de nuevo.'));
    }
  }

  async function commitPages() {
    const pages = preview ? [...captured, preview] : captured;
    if (!pages.length) return;
    setBusy(true);
    setError('');
    const attachments = [];
    try {
      for (let index = 0; index < pages.length; index += 1) {
        attachments.push(await persistImportedAttachment({ uri: pages[index].uri, name: `bill-page-${index + 1}.jpg`, mimeType: 'image/jpeg' }, kind));
      }
      if (attachments.reduce((total, attachment) => total + (attachment.size ?? 0), 0) > 15 * 1024 * 1024) throw new Error('upload-too-large');
      // The same commit and next step as the document import flow (components/document-import.tsx).
      const caseId = useUnfoldStore.getState().addImportedBatch(attachments, params.caseId);
      router.replace({ pathname: '/confirm-documents', params: { caseId } });
    } catch (failure) {
      await Promise.all(attachments.map(attachment => deleteAttachment(attachment).catch(() => {})));
      setError(failure instanceof Error && failure.message === 'upload-too-large'
        ? copy('These photos exceed the 15 MB upload limit. Retake them with fewer pages.','Estas fotos superan el límite de carga de 15 MB. Vuelve a tomarlas con menos páginas.')
        : copy('The photos could not be saved. Try again.','No se pudieron guardar las fotos. Inténtalo de nuevo.'));
    } finally { setBusy(false); }
  }

  if (!permission?.granted) {
    return <Screen footer={<Button title={permission?.canAskAgain ? copy('Allow camera','Permitir cámara') : copy('Open settings','Abrir ajustes')} onPress={() => permission?.canAskAgain ? void requestPermission() : void Linking.openSettings()} />}>
      <Feedback danger title={copy('Camera access is off','El acceso a la cámara está desactivado')} text={copy('Enable camera access to take a bill photo.','Activa el acceso a la cámara para fotografiar una factura.')} />
    </Screen>;
  }

  return <Screen testID="camera" footer={preview
    ? <Group style={{ flexDirection: 'row', gap: space.md }}><Button style={{ flex: 1 }} title={copy('Retake','Repetir')} variant="secondary" onPress={() => setPreview(null)} /><Button style={{ flex: 1 }} title={copy('Keep page','Guardar página')} onPress={() => { setCaptured(pages => [...pages, preview]); setPreview(null); }} /></Group>
    : <Group style={{ flexDirection: 'row', gap: space.md }}><Button style={{ flex: 1 }} title={copy('Capture page','Capturar página')} disabled={!ready || busy} onPress={() => void capture()} /><Button style={{ flex: 1 }} title={copy('Use photos','Usar fotos')} variant="secondary" disabled={!captured.length || busy} loading={busy} onPress={() => void commitPages()} /></Group>}>
    <Group><Txt variant="title">{copy('Photograph your bill','Fotografía tu factura')}</Txt><Txt muted>{copy(`Page ${captured.length + (preview ? 1 : 0)}${captured.length ? ' captured' : ''}`,`Página ${captured.length + (preview ? 1 : 0)}${captured.length ? ' capturada' : ''}`)}</Txt></Group>
    <View style={{ height: 440, overflow: 'hidden', borderRadius: 24, backgroundColor: '#101820' }}>
      {preview ? <Image source={{ uri: preview.uri }} resizeMode="contain" style={{ flex: 1 }} /> : <CameraView ref={camera} style={{ flex: 1 }} facing="back" mode="picture" onCameraReady={() => setReady(true)} onMountError={() => setError(copy('The camera could not start.','No se pudo iniciar la cámara.'))} />}
      {!preview ? <View pointerEvents="none" style={{ position: 'absolute', top: '9%', bottom: '9%', left: '7%', right: '7%', borderWidth: 2, borderColor: 'rgba(255,255,255,.82)', borderRadius: 16 }} /> : null}
    </View>
    {captured.length ? <Group style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{captured.map((page, index) => <Pressable key={`${page.uri}-${index}`} accessibilityRole="button" accessibilityLabel={copy(`Remove page ${index + 1}`,`Quitar página ${index + 1}`)} onPress={() => setCaptured(items => items.filter((_, itemIndex) => itemIndex !== index))}><Image source={{ uri: page.uri }} style={{ width: 58, height: 76, borderRadius: 8, backgroundColor: colors.surface }} /></Pressable>)}</Group> : null}
    {error ? <Feedback danger text={error} /> : null}
  </Screen>;
}
