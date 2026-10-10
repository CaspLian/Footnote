import * as Clipboard from 'expo-clipboard';
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { createLocalId } from './documents';
import { NativeActionError } from './errors';
import { draftToHtml, type DraftExport } from './export-content';

export async function copyDraft(text: string): Promise<void> {
  if (!text.trim()) throw new NativeActionError('empty-draft');
  try {
    await Clipboard.setStringAsync(text);
  } catch {
    throw new NativeActionError('clipboard-failed');
  }
}

export async function exportDraftPdf(draft: DraftExport): Promise<{ uri: string }> {
  if (!draft.body.trim()) throw new NativeActionError('empty-draft');
  let temporary: File | undefined;
  let destination: File | undefined;
  try {
    // These drafts contain text only. The system markup renderer avoids a
    // WebKit load dependency when exporting on iOS simulators.
    const result = await Print.printToFileAsync({ html: draftToHtml(draft), base64: false, useMarkupFormatter: Platform.OS === 'ios' });
    temporary = new File(result.uri);
    const directory = new Directory(Paths.document, 'unfold', 'exports');
    directory.create({ intermediates: true, idempotent: true });
    destination = new File(directory, `${createLocalId('unfold-draft')}.pdf`);
    await temporary.copy(destination); // asynchronous since expo-file-system 57
    if (!destination.exists || destination.size <= 0) throw new Error('Export did not create a file');
    return { uri: destination.uri };
  } catch {
    if (destination?.exists) destination.delete();
    throw new NativeActionError('export-failed');
  } finally {
    if (temporary?.exists) temporary.delete();
  }
}

export async function shareDocument(uri: string): Promise<'shared' | 'unavailable'> {
  try {
    if (!(await Sharing.isAvailableAsync())) return 'unavailable';
    if (!uri.startsWith('file://') || !new File(uri).exists) throw new NativeActionError('file-unavailable');
    await Sharing.shareAsync(uri, { mimeType: uri.toLowerCase().endsWith('.pdf') ? 'application/pdf' : undefined });
    // OS sharing APIs report that the sheet closed, not whether a recipient received it.
    return 'shared';
  } catch (error) {
    throw error instanceof NativeActionError ? error : new NativeActionError('sharing-failed');
  }
}
