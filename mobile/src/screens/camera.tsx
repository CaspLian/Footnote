import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { DocumentKind } from '@/domain';
import { deleteAttachment, persistImportedAttachment } from '@/native';
import { Button, Card, Feedback, Group, Screen, Txt, useLanguage } from '@/components/ui';
import { Icon } from '@/components/icon';
import { cameraAccessState } from '@/native/camera-access';
import { useFootnoteStore } from '@/store';
import { space, useTheme } from '@/theme';

export function CameraCapture() {
  const { copy } = useLanguage();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ caseId?: string; kind?: string }>();
  const kind: DocumentKind = params.kind === 'bill' || params.kind === 'eob' || params.kind === 'policy' ? params.kind : 'auto';
  const [permission, requestPermission, refreshPermission] = useCameraPermissions();
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [permissionError, setPermissionError] = useState(false);
  const [focused, setFocused] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const requested = useRef(false);
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  type PictureItem = { uri: string; width?: number; height?: number };
  const [captured, setCaptured] = useState<PictureItem[]>([]);
  const [preview, setPreview] = useState<PictureItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [takingPhoto, setTakingPhoto] = useState(false);
  const [error, setError] = useState('');

  const checkPermission = useCallback(async () => {
    setCheckingPermission(true);
    setPermissionError(false);
    try { await refreshPermission(); }
    catch { setPermissionError(true); }
    finally { setCheckingPermission(false); }
  }, [refreshPermission]);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    void checkPermission();
    return () => { setFocused(false); setReady(false); };
  }, [checkPermission]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setAppActive(state === 'active');
      if (state === 'active') void checkPermission();
    });
    return () => subscription.remove();
  }, [checkPermission]);
  const askPermission = useCallback(async () => {
    setCheckingPermission(true);
    setPermissionError(false);
    try { await requestPermission(); }
    catch { setPermissionError(true); }
    finally { setCheckingPermission(false); }
  }, [requestPermission]);
  useEffect(() => {
    if (!checkingPermission && permission?.status === 'undetermined' && !requested.current) {
      requested.current = true;
      void askPermission();
    }
  }, [permission?.status, checkingPermission, askPermission]);

  async function capture() {
    if (!ready || !camera.current || busy || takingPhoto) return;
    if (captured.length >= 10) {
      setError(copy('A scan can include up to 10 pages.','El escaneo admite hasta 10 páginas.'));
      return;
    }
    setError('');
    setTakingPhoto(true);
    try {
      setPreview(await camera.current.takePictureAsync({ quality: 0.85 }));
    } catch {
      setError(copy('The photo could not be captured. Try again.','No se pudo tomar la foto. Inténtalo de nuevo.'));
    } finally { setTakingPhoto(false); }
  }

  async function pickFromPhotos() {
    if (busy || takingPhoto || captured.length >= 10) return;
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
        allowsMultipleSelection: true,
        selectionLimit: 10 - captured.length,
        orderedSelection: true,
      });
      if (result.canceled || !result.assets || !result.assets.length) return;
      if (result.assets.length === 1) {
        setPreview(result.assets[0]);
      } else {
        const [first, ...rest] = result.assets;
        setPreview(first);
        setCaptured(existing => [...existing, ...rest]);
      }
    } catch {
      setError(copy('Could not open photos. Try again.', 'No se pudieron abrir las fotos. Inténtalo de nuevo.'));
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
      const caseId = useFootnoteStore.getState().addImportedBatch(attachments, params.caseId);
      router.replace({ pathname: '/confirm-documents', params: { caseId } });
    } catch (failure) {
      await Promise.all(attachments.map(attachment => deleteAttachment(attachment).catch(() => {})));
      setError(failure instanceof Error && failure.message === 'upload-too-large'
        ? copy('These photos exceed the 15 MB upload limit. Retake them with fewer pages.','Estas fotos superan el límite de carga de 15 MB. Vuelve a tomarlas con menos páginas.')
        : copy('The photos could not be saved. Try again.','No se pudieron guardar las fotos. Inténtalo de nuevo.'));
    } finally { setBusy(false); }
  }

  const access = cameraAccessState(permission, checkingPermission);
  if (permissionError || access !== 'granted') {
    return <Screen>
      <Card><Group gap={space.lg}>
        <Txt variant="title">{copy('Photograph bill','Fotografía tu factura')}</Txt>
        {access === 'checking' && !permissionError ? <Group style={{ flexDirection: 'row', alignItems: 'center' }}><ActivityIndicator color={colors.accent} /><Txt muted>{copy('Checking camera access…','Comprobando acceso a la cámara…')}</Txt></Group> : <>
          <Txt muted>{permissionError ? copy('Camera access could not be checked. Try again.','No se pudo comprobar el acceso a la cámara. Inténtalo de nuevo.') : copy('Allow camera access to photograph your bill. You can also choose an existing photo or PDF from Add documents.','Permite el acceso a la cámara para fotografiar tu factura. También puedes elegir una foto o PDF en Añadir documentos.')}</Txt>
          <Button title={permissionError ? copy('Try again','Intentar de nuevo') : permission?.canAskAgain ? copy('Allow camera','Permitir cámara') : copy('Open settings','Abrir ajustes')} onPress={() => permissionError ? void checkPermission() : permission?.canAskAgain ? void askPermission() : void Linking.openSettings().catch(() => setPermissionError(true))} />
        </>}
      </Group></Card>
    </Screen>;
  }

  return <Screen testID="camera" searchMode={true} footer={preview
    ? <Group gap={space.md}>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button
            disabled={busy}
            title={copy('Retake', 'Repetir')}
            icon="camera"
            variant="secondary"
            onPress={() => { setReady(false); setPreview(null); }}
            style={{ flex: 1 }}
          />
          <Button
            disabled={busy || captured.length >= 9}
            title={copy('Add another', 'Añadir otra')}
            icon="plus"
            variant="secondary"
            onPress={() => { setCaptured(pages => [...pages, preview]); setReady(false); setPreview(null); }}
            style={{ flex: 1 }}
          />
        </View>
        <Button
          title={captured.length ? copy('Use photos', 'Usar fotos') : copy('Use photo', 'Usar foto')}
          icon="check"
          loading={busy}
          onPress={() => void commitPages()}
        />
      </Group>
    : <Group gap={space.md}>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button
            title={copy('Capture image', 'Capturar imagen')}
            icon="camera"
            loading={takingPhoto}
            disabled={!ready || busy}
            onPress={() => void capture()}
            style={{ flex: 1 }}
          />
          <Button
            title={copy('Photos', 'Fotos')}
            icon="images"
            variant="secondary"
            disabled={busy || takingPhoto || captured.length >= 10}
            onPress={() => void pickFromPhotos()}
            style={{ flex: 1 }}
          />
        </View>
        {captured.length ? (
          <Button
            title={captured.length === 1 ? copy('Use photo', 'Usar foto') : copy('Use photos', 'Usar fotos')}
            icon="check"
            variant="secondary"
            disabled={busy || takingPhoto}
            loading={busy}
            onPress={() => void commitPages()}
          />
        ) : null}
      </Group>}>
    <Group gap={space.xs}><Txt variant="title">{copy('Photograph bill','Fotografía tu factura')}</Txt><Txt muted>{preview ? captured.length ? `${captured.length + 1} photos ready` : 'Photo ready' : captured.length ? `${captured.length} photos saved. Capture another page or continue.` : 'Fit the full page inside the frame.'}</Txt></Group>
    <View style={{ height: 440, overflow: 'hidden', borderRadius: 24, backgroundColor: '#101820' }}>
      {preview ? <Image source={{ uri: preview.uri }} resizeMode="contain" style={{ flex: 1 }} /> : focused ? <CameraView ref={camera} active={appActive} style={{ flex: 1 }} facing="back" mode="picture" onCameraReady={() => setReady(true)} onMountError={() => setError(copy('The camera could not start.','No se pudo iniciar la cámara.'))} /> : null}
      {!preview ? <View pointerEvents="none" style={{ position: 'absolute', top: '9%', bottom: '9%', left: '7%', right: '7%', borderWidth: 2, borderColor: 'rgba(255,255,255,.82)', borderRadius: 16 }} /> : null}
    </View>
    {captured.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: space.md, paddingVertical: 4 }}>
      {captured.map((page, index) => (
        <Pressable
          key={`${page.uri}-${index}`}
          accessibilityRole="button"
          accessibilityLabel={copy(`Remove page ${index + 1}`, `Quitar página ${index + 1}`)}
          onPress={() => {
            if (Platform.OS !== 'web') {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            }
            setCaptured(items => items.filter((_, itemIndex) => itemIndex !== index));
          }}
          style={{ position: 'relative' }}
        >
          <Image source={{ uri: page.uri }} style={{ width: 48, height: 64, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }} />
          <View style={{
            position: 'absolute',
            top: -5,
            right: -5,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: colors.line,
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.18)',
          }}>
            <Icon name="close" size={10} color={colors.ink} />
          </View>
        </Pressable>
      ))}
    </ScrollView> : null}
    {error ? <Feedback danger text={error} /> : null}
  </Screen>;
}
