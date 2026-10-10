import type { Language } from '@/domain';

export type NativeErrorCode =
  | 'empty-file'
  | 'file-too-large'
  | 'unsupported-file'
  | 'invalid-pdf'
  | 'invalid-image'
  | 'file-unavailable'
  | 'import-failed'
  | 'camera-unavailable'
  | 'voice-unavailable'
  | 'narration-failed'
  | 'empty-draft'
  | 'export-failed'
  | 'sharing-unavailable'
  | 'sharing-failed'
  | 'clipboard-failed';

export const nativeMessages: Record<NativeErrorCode, Record<Language, string>> = {
  'empty-file': {
    en: 'This file is empty. Choose another document.',
    es: 'Este archivo está vacío. Elige otro documento.',
  },
  'file-too-large': {
    en: 'Choose a file smaller than 20 MB, or photograph the pages you need.',
    es: 'Elige un archivo de menos de 20 MB o fotografía las páginas que necesitas.',
  },
  'unsupported-file': {
    en: 'Choose a PDF, JPEG, PNG, WebP, HEIC, or HEIF document.',
    es: 'Elige un documento PDF, JPEG, PNG, WebP, HEIC o HEIF.',
  },
  'invalid-pdf': {
    en: 'This file is not a readable PDF. Export it as a PDF again, or choose a photo.',
    es: 'Este archivo no es un PDF válido. Expórtalo de nuevo como PDF o elige una foto.',
  },
  'invalid-image': {
    en: 'This image could not be read. Choose another photo or a PDF.',
    es: 'No se pudo leer esta imagen. Elige otra foto o un PDF.',
  },
  'file-unavailable': {
    en: 'The document is no longer available on this device. Import it again.',
    es: 'El documento ya no está disponible en este dispositivo. Impórtalo de nuevo.',
  },
  'import-failed': {
    en: 'The document could not be saved. Try importing it again.',
    es: 'No se pudo guardar el documento. Intenta importarlo de nuevo.',
  },
  'camera-unavailable': {
    en: 'The camera is unavailable. Choose a photo or a file instead.',
    es: 'La cámara no está disponible. Elige una foto o un archivo.',
  },
  'voice-unavailable': {
    en: 'An English voice is not available on this device. Add one in device speech settings, then try again.',
    es: 'No hay una voz en español disponible en este dispositivo. Añádela en los ajustes de voz del dispositivo e inténtalo de nuevo.',
  },
  'narration-failed': {
    en: 'Read aloud could not start. Check your device audio and try again.',
    es: 'No se pudo iniciar la lectura en voz alta. Comprueba el audio del dispositivo e inténtalo de nuevo.',
  },
  'empty-draft': {
    en: 'Write a draft before copying or exporting it.',
    es: 'Escribe un borrador antes de copiarlo o exportarlo.',
  },
  'export-failed': {
    en: 'The PDF could not be created. Your draft is still saved; try again.',
    es: 'No se pudo crear el PDF. Tu borrador sigue guardado; inténtalo de nuevo.',
  },
  'sharing-unavailable': {
    en: 'Sharing is unavailable on this device. You can copy the draft instead.',
    es: 'No se puede compartir desde este dispositivo. Puedes copiar el borrador.',
  },
  'sharing-failed': {
    en: 'The document could not be shared. Try again or copy your draft.',
    es: 'No se pudo compartir el documento. Inténtalo de nuevo o copia el borrador.',
  },
  'clipboard-failed': {
    en: 'The draft could not be copied. Try again or export a PDF.',
    es: 'No se pudo copiar el borrador. Inténtalo de nuevo o exporta un PDF.',
  },
};

export class NativeActionError extends Error {
  constructor(public readonly code: NativeErrorCode) {
    super(nativeMessages[code].en);
    this.name = 'NativeActionError';
  }
}

export function nativeErrorMessage(error: unknown, language: Language): string {
  const code = error instanceof NativeActionError ? error.code
    : error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      && Object.prototype.hasOwnProperty.call(nativeMessages, error.code)
      ? error.code as NativeErrorCode : 'import-failed';
  return nativeMessages[code][language];
}
