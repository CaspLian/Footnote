import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import type { DocumentAttachment, DocumentKind } from '@/domain';
import { NativeActionError, nativeMessages, type NativeErrorCode } from './errors';
import { classifyPickerOutcome, safeDisplayFilename, validateFileMetadata, validateImportedFile } from './import-validation';

export type ImportSource = 'camera' | 'photos' | 'files';
export type ImportPreparation = (file: { name: string }) => void | Promise<void>;
export type ImportResult =
  | { status: 'success'; attachment: DocumentAttachment; additionalAttachments?: DocumentAttachment[] }
  | { status: 'cancelled' }
  | { status: 'permission-denied'; canAskAgain: boolean }
  | { status: 'error'; code: NativeErrorCode; message: { en: string; es: string } };

type PickedFile = { uri: string; name: string; mimeType?: string; size?: number };

/** Expo resolves picker results before UIKit's animated dismissal has finished. */
async function finishPickerDismissal() {
  // Do not present a loader, alert, or push a native screen over the closing picker.
  // The loader lives in the current screen; this short iOS handoff also covers cancellation.
  if (Platform.OS === 'ios') await new Promise<void>(resolve => setTimeout(resolve, 450));
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

export function appendAttachmentToForm(form: FormData, attachment: DocumentAttachment, field = 'files'): void {
  // The global fetch is Expo's: it sends parts that are strings, Blobs or objects with bytes(), and refuses React
  // Native's { uri, name, type } parts ("Unsupported FormDataPart implementation"). name and type become the part's
  // filename and content type; the backend checks the type.
  const file = new File(attachment.uri);
  form.append(field, { name: attachment.name, type: attachment.mimeType, bytes: () => file.bytes() } as unknown as Blob);
}

function storageDirectory() {
  return new Directory(Paths.document, 'footnote', 'attachments');
}

export function createLocalId(prefix = 'attachment') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Returns only after a checked copy exists outside the temporary picker cache. */
export async function persistImportedAttachment(asset: PickedFile, kind: DocumentKind): Promise<DocumentAttachment> {
  const metadataError = validateFileMetadata(asset);
  if (metadataError) throw new NativeActionError(metadataError);
  const source = new File(asset.uri);
  if (!source.exists) throw new NativeActionError('file-unavailable');
  const size = source.size;
  const actualMetadataError = validateFileMetadata({ ...asset, size });
  if (actualMetadataError) throw new NativeActionError(actualMetadataError);
  const handle = source.open(FileMode.ReadOnly);
  let header: Uint8Array;
  try {
    header = handle.readBytes(Math.min(size, 32));
  } finally {
    handle.close();
  }
  const validation = validateImportedFile({ ...asset, size }, header);
  if (!validation.valid) throw new NativeActionError(validation.code);
  const directory = storageDirectory();
  directory.create({ intermediates: true, idempotent: true });
  const id = createLocalId();
  const destination = new File(directory, `${id}.${validation.extension}`);
  try {
    await source.copy(destination); // asynchronous since expo-file-system 57: check the copy only once it is done
    if (!destination.exists || destination.size !== size) throw new NativeActionError('import-failed');
    return {
      id,
      uri: destination.uri,
      name: safeDisplayFilename(asset.name),
      mimeType: validation.mimeType,
      size,
      kind,
      origin: 'import',
      importedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (destination.exists) destination.delete();
    throw error instanceof NativeActionError ? error : new NativeActionError('import-failed');
  }
}

export async function importDocument(source: ImportSource, kind: DocumentKind = 'auto', onPreparing?: ImportPreparation): Promise<ImportResult> {
  const saved: DocumentAttachment[] = [];
  try {
    let picked: PickedFile[];
    if (source === 'files') {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'], copyToCacheDirectory: true, multiple: true });
      await finishPickerDismissal();
      const outcome = classifyPickerOutcome(result);
      if (outcome.status !== 'selected') return outcome.status === 'error' ? { ...outcome, message: nativeMessages[outcome.code] } : outcome;
      picked = result.assets!;
    } else {
      if (source === 'camera') { const permission = await ImagePicker.requestCameraPermissionsAsync(); if (!permission.granted) return { status: 'permission-denied', canAskAgain: permission.canAskAgain }; }
      const result = await (source === 'camera'
        ? ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1, cameraType: ImagePicker.CameraType.back })
        : ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'], allowsEditing: false, quality: 1,
          allowsMultipleSelection: true, selectionLimit: 10, orderedSelection: true,
          // Copy the original to the picker cache instead of decoding/re-encoding every page.
          preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
        }));
      await finishPickerDismissal();
      const outcome = classifyPickerOutcome(result);
      if (outcome.status !== 'selected') return outcome.status === 'error' ? { ...outcome, message: nativeMessages[outcome.code] } : outcome;
      picked = result.assets!.map(a => ({ uri: a.uri, name: a.fileName ?? 'document.jpg', mimeType: a.mimeType, size: a.fileSize }));
    }
    if (picked.length > 10) return { status: 'error', code: 'import-failed', message: { en: 'Choose up to 10 documents at a time. You can add more before starting the review.', es: 'Elige hasta 10 documentos a la vez. Puedes agregar más antes de revisar.' } };
    for (const [index, file] of picked.entries()) {
      await onPreparing?.({ name: picked.length > 1 ? `${index + 1} of ${picked.length} · ${safeDisplayFilename(file.name)}` : safeDisplayFilename(file.name) });
      saved.push(await persistImportedAttachment(file, kind));
    }
    return { status: 'success', attachment: saved[0], additionalAttachments: saved.slice(1) };
  } catch (error) {
    await Promise.all(saved.map(a => deleteAttachment(a).catch(() => {})));
    const code = error instanceof NativeActionError ? error.code : source === 'camera' ? 'camera-unavailable' : 'import-failed';
    return { status: 'error', code, message: nativeMessages[code] };
  }
}

export async function deleteAttachment(attachment: DocumentAttachment): Promise<void> {
  if (attachment.origin !== 'import') return;
  if (!attachment.uri.startsWith('file://')) return;
  const file = new File(attachment.uri);
  if (file.parentDirectory.uri.replace(/\/$/, '') !== storageDirectory().uri.replace(/\/$/, '')) return;
  if (file.exists) file.delete();
}

/** Removes Footnote-owned imports and exported drafts. */
export async function clearLocalAttachments(): Promise<void> {
  const directory = new Directory(Paths.document, 'footnote');
  if (directory.exists) directory.delete();
}
