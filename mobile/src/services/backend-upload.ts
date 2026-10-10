import type { DocumentAttachment } from '../domain/types';

/** React Native's FormData uploads a local file given as {uri, name, type}; type must be exact (image/jpeg, not image/jpg). */
export async function uploadPart(attachment: DocumentAttachment): Promise<Blob> {
  return { uri: attachment.uri, name: attachment.name, type: attachment.mimeType } as unknown as Blob;
}
