import type { NativeErrorCode } from './errors';

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export type FileMetadata = { name: string; mimeType?: string; size?: number };
export type FileValidation =
  | { valid: true; mimeType: string; extension: string }
  | { valid: false; code: NativeErrorCode };

const supportedTypes: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};
const extensionTypes: Record<string, string> = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

export function detectFileType(header: Uint8Array): string | undefined {
  const starts = (bytes: number[]) => bytes.every((byte, index) => header[index] === byte);
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...header.slice(start, start + length));
  if (ascii(0, 5) === '%PDF-') return 'application/pdf';
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  if (ascii(4, 4) === 'ftyp') {
    const brands = ascii(8, 24);
    if (/heic|heix|hevc|hevx/.test(brands)) return 'image/heic';
    if (/mif1|msf1/.test(brands)) return 'image/heif';
  }
  return undefined;
}

export function validateFileMetadata(metadata: FileMetadata): NativeErrorCode | undefined {
  if (metadata.size !== undefined) {
    if (!Number.isFinite(metadata.size) || metadata.size <= 0) return 'empty-file';
    if (metadata.size > MAX_IMPORT_BYTES) return 'file-too-large';
  }
  const declared = metadata.mimeType?.toLowerCase().split(';')[0].trim();
  const extension = metadata.name.split('.').pop()?.toLowerCase() ?? '';
  if (declared && declared !== 'application/octet-stream' && !supportedTypes[declared]) {
    return 'unsupported-file';
  }
  if ((!declared || declared === 'application/octet-stream') && !extensionTypes[extension]) {
    return 'unsupported-file';
  }
  return undefined;
}

/** Inspect real bytes; a .pdf filename alone must never make an arbitrary file valid. */
export function validateImportedFile(metadata: FileMetadata, header: Uint8Array): FileValidation {
  const metadataError = validateFileMetadata(metadata);
  if (metadataError) return { valid: false, code: metadataError };
  if (!header.length) return { valid: false, code: 'empty-file' };
  const declared = metadata.mimeType?.toLowerCase().split(';')[0].trim();
  const extension = metadata.name.split('.').pop()?.toLowerCase() ?? '';
  const expected = declared && supportedTypes[declared] ? declared : extensionTypes[extension];
  const actual = detectFileType(header);
  if (!actual || (expected === 'application/pdf' && actual !== expected)) {
    return { valid: false, code: expected === 'application/pdf' ? 'invalid-pdf' : 'invalid-image' };
  }
  if (expected && actual !== expected && !(expected.startsWith('image/') && actual.startsWith('image/'))) {
    return { valid: false, code: 'unsupported-file' };
  }
  return { valid: true, mimeType: actual, extension: supportedTypes[actual] };
}

export function classifyPickerOutcome<T>(result: { canceled: boolean; assets: T[] | null }):
  | { status: 'cancelled' }
  | { status: 'selected'; asset: T }
  | { status: 'error'; code: NativeErrorCode } {
  if (result.canceled) return { status: 'cancelled' };
  if (!result.assets?.[0]) return { status: 'error', code: 'import-failed' };
  return { status: 'selected', asset: result.assets[0] };
}

export function safeDisplayFilename(name: string): string {
  return name.replace(/[\u0000-\u001f\u007f]/g, '').split(/[\\/]/).pop()?.slice(0, 160) || 'document';
}
