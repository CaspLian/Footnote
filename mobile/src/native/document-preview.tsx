import { useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { File } from 'expo-file-system';
import Pdf from 'react-native-pdf';
import type { DocumentAttachment, Language } from '@/domain';
import { Button, Field, Txt } from '@/components/ui';
import { UnfoldLoader } from '@/components/loader';
import { colors, radius, sizes, space } from '@/theme';
import { nativeErrorMessage, nativeMessages, type NativeErrorCode } from './errors';
import { shareDocument } from './exports';

type PreviewState = 'loading' | 'ready' | 'locked' | 'error';
type Props = {
  attachment: DocumentAttachment;
  language: Language;
  style?: StyleProp<ViewStyle>;
  onError?: (code: NativeErrorCode) => void;
  onLoad?: (pageCount: number) => void;
};

function canReadLocalDocument(uri: string) {
  try { return uri.startsWith('file://') && new File(uri).exists; } catch { return false; }
}

export function DocumentPreview(props: Props) {
  // Remount on a new document so its password and page state never leak to another attachment.
  return <DocumentPreviewContent key={props.attachment.uri} {...props} />;
}

function DocumentPreviewContent({ attachment, language, style, onError, onLoad }: Props) {
  const [state, setState] = useState<PreviewState>(() => canReadLocalDocument(attachment.uri) ? 'loading' : 'error');
  const [errorCode, setErrorCode] = useState<NativeErrorCode>('file-unavailable');
  const [passwordInput, setPasswordInput] = useState('');
  const [password, setPassword] = useState('');
  const [revision, setRevision] = useState(0);
  const [pages, setPages] = useState(attachment.pageCount ?? 1);
  const [page, setPage] = useState(1);
  const [shareError, setShareError] = useState<string>();
  const [sharing, setSharing] = useState(false);
  const copy = (en: string, es: string) => language === 'es' ? es : en;
  const isPdf = attachment.mimeType === 'application/pdf';

  const fail = (code: NativeErrorCode) => {
    setErrorCode(code);
    setState('error');
    onError?.(code);
  };
  const retry = () => {
    if (!canReadLocalDocument(attachment.uri)) { fail('file-unavailable'); return; }
    setState('loading');
    setRevision(value => value + 1);
  };
  const share = async () => {
    setSharing(true);
    setShareError(undefined);
    try {
      if (await shareDocument(attachment.uri) === 'unavailable') {
        setShareError(nativeMessages['sharing-unavailable'][language]);
      }
    } catch (error) {
      setShareError(nativeErrorMessage(error, language));
    } finally { setSharing(false); }
  };

  return <View style={[styles.container, style]}>
    <View style={styles.heading}>
      <Txt variant="label" style={{ flex: 1 }} selectable>{attachment.name}</Txt>
      {attachment.origin === 'sample' ? <Txt variant="caption" accent>{copy('Sample', 'Ejemplo')}</Txt> : null}
    </View>
    {state === 'locked' ? <View style={styles.recovery}>
      <Txt variant="section">{copy('This PDF needs a password', 'Este PDF necesita una contraseña')}</Txt>
      <Txt muted selectable>{copy('Enter the document password to preview it. The password stays on this screen and is never saved.', 'Introduce la contraseña del documento para verlo. La contraseña permanece en esta pantalla y nunca se guarda.')}</Txt>
      <Field label={copy('Document password', 'Contraseña del documento')} secureTextEntry value={passwordInput} onChangeText={setPasswordInput} autoCapitalize="none" autoCorrect={false} returnKeyType="done" />
      <Button title={copy('Unlock PDF', 'Abrir PDF')} disabled={!passwordInput} onPress={() => { setPassword(passwordInput); retry(); }} />
      {password ? <Txt accessibilityRole="alert" selectable style={{ color: colors.error }}>{copy('That password did not open the document. Check it and try again.', 'Esa contraseña no abrió el documento. Compruébala e inténtalo de nuevo.')}</Txt> : null}
    </View> : state === 'error' ? <View style={styles.recovery}>
      <Txt variant="section">{copy('Preview unavailable', 'Vista previa no disponible')}</Txt>
      <Txt accessibilityRole="alert" selectable muted>{nativeMessages[errorCode][language]}</Txt>
      <Button variant="secondary" title={copy('Try preview again', 'Reintentar vista previa')} onPress={retry} />
    </View> : <View style={styles.document}>
      {isPdf ? <Pdf
        key={`${attachment.id}-${revision}`}
        source={{ uri: attachment.uri, cache: false }}
        password={password}
        trustAllCerts={false}
        enablePaging
        style={styles.media}
        onLoadComplete={count => { setPages(count); setState('ready'); onLoad?.(count); }}
        onPageChanged={nextPage => setPage(nextPage)}
        onError={error => {
          if (/password|encrypt/i.test(String(error))) setState('locked');
          else fail('invalid-pdf');
        }}
      /> : <Image
        key={`${attachment.id}-${revision}`}
        source={{ uri: attachment.uri }}
        style={styles.media}
        contentFit="contain"
        accessibilityLabel={attachment.name}
        onLoad={() => { setState('ready'); onLoad?.(1); }}
        onError={() => fail('invalid-image')}
      />}
      {state === 'loading' ? <View style={styles.loading} pointerEvents="none">
        <UnfoldLoader compact title={copy('Opening your document', 'Abriendo tu documento')} detail={copy('Keeping the original in view.', 'Manteniendo el original a la vista.')} />
      </View> : null}
    </View>}
    <View style={styles.footer}>
      <Txt variant="caption" muted>{isPdf && state === 'ready' ? copy(`Page ${page} of ${pages} · Pinch to zoom`, `Página ${page} de ${pages} · Amplía con dos dedos`) : copy('Original document', 'Documento original')}</Txt>
      <Button variant="quiet" title={copy('Open in another app', 'Abrir en otra app')} loading={sharing} onPress={() => { void share(); }} />
    </View>
    {shareError ? <Txt accessibilityRole="alert" selectable style={{ color: colors.error, paddingHorizontal: space.lg }}>{shareError}</Txt> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.control, borderCurve: 'continuous', overflow: 'hidden', gap: space.sm, paddingBottom: space.sm },
  heading: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.sm, flexDirection: 'row', alignItems: 'flex-start' },
  document: { height: sizes.preview, backgroundColor: colors.background },
  media: { flex: 1, width: '100%', backgroundColor: colors.background },
  loading: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: space.sm, backgroundColor: colors.background },
  recovery: { padding: space.lg, gap: space.lg },
  footer: { paddingHorizontal: space.lg, gap: space.xs },
});
