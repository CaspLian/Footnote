import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import type { DocumentAttachment, DocumentKind } from '@/domain';
import { NativeActionError, nativeMessages, type NativeErrorCode } from './errors';
import { classifyPickerOutcome, safeDisplayFilename, validateFileMetadata, validateImportedFile } from './import-validation';

export type ImportSource = 'camera' | 'photos' | 'files';
export type ImportResult =
  | { status: 'success'; attachment: DocumentAttachment }
  | { status: 'cancelled' }
  | { status: 'permission-denied'; canAskAgain: boolean }
  | { status: 'error'; code: NativeErrorCode; message: { en: string; es: string } };

type PickedFile = { uri: string; name: string; mimeType?: string; size?: number };

export function appendAttachmentToForm(form: FormData, attachment: DocumentAttachment): void {
  form.append('files', { uri: attachment.uri, name: attachment.name, type: attachment.mimeType } as unknown as Blob);
}

function storageDirectory() {
  return new Directory(Paths.document, 'unfold', 'attachments');
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

export async function importDocument(source: ImportSource, kind: DocumentKind = 'bill'): Promise<ImportResult> {
  try {
    let picked: PickedFile;
    if (source === 'files') {
      const result = classifyPickerOutcome(await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
        copyToCacheDirectory: true,
        multiple: false,
      }));
      if (result.status !== 'selected') {
        return result.status === 'error'
          ? { ...result, message: nativeMessages[result.code] }
          : result;
      }
      picked = result.asset;
    } else {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return { status: 'permission-denied', canAskAgain: permission.canAskAgain };
      }
      // The OS photo picker grants access to the selected photo without broad library access.
      const result = classifyPickerOutcome(await (source === 'camera'
        ? ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1, cameraType: ImagePicker.CameraType.back })
        : ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1, allowsMultipleSelection: false })));
      if (result.status !== 'selected') {
        return result.status === 'error'
          ? { ...result, message: nativeMessages[result.code] }
          : result;
      }
      const asset = result.asset;
      picked = { uri: asset.uri, name: asset.fileName ?? 'document.jpg', mimeType: asset.mimeType, size: asset.fileSize };
    }
    return { status: 'success', attachment: await persistImportedAttachment(picked, kind) };
  } catch (error) {
    const code = error instanceof NativeActionError ? error.code : source === 'camera' ? 'camera-unavailable' : 'import-failed';
    return { status: 'error', code, message: nativeMessages[code] };
  }
}

export async function deleteAttachment(attachment: DocumentAttachment): Promise<void> {
  if (attachment.origin !== 'import') return;
  const directory = storageDirectory();
  if (!attachment.uri.startsWith('file://')) return;
  const file = new File(attachment.uri);
  if (file.parentDirectory.uri.replace(/\/$/, '') !== directory.uri.replace(/\/$/, '')) return;
  if (file.exists) file.delete();
}

/** Removes app-owned imports and exported drafts; bundled sample documents stay available. */
export async function clearLocalAttachments(): Promise<void> {
  const directory = new Directory(Paths.document, 'unfold');
  if (directory.exists) directory.delete();
}
