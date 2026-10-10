import type { DocumentAttachment } from '../domain/types';
import { readAttachmentBlob } from '../native/documents.web';

/** In the browser, imports live in IndexedDB. Send the stored file with its validated type, which the backend checks exactly. */
export async function uploadPart(attachment: DocumentAttachment): Promise<Blob> {
  const blob = await readAttachmentBlob(attachment.uri);
  return new Blob([blob], { type: attachment.mimeType });
}
