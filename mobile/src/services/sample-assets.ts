import { Asset } from 'expo-asset';
import { SAMPLE_DOCUMENT_IDS } from '../domain/fixtures';
import type { DocumentAttachment, Language } from '../domain/types';

const sampleAssets = {
  en: { bill: require('../../assets/fixtures/northline-bill-en.pdf'), eob: require('../../assets/fixtures/northline-eob-en.pdf') },
  es: { bill: require('../../assets/fixtures/northline-bill-es.pdf'), eob: require('../../assets/fixtures/northline-eob-es.pdf') },
} as const;

export async function resolveSampleAttachments(language: Language = 'en', at = new Date().toISOString()): Promise<DocumentAttachment[]> {
  return Promise.all((['bill', 'eob'] as const).map(async kind => {
    const asset = Asset.fromModule(sampleAssets[language][kind]);
    await asset.downloadAsync();
    if (!asset.localUri) throw new Error('sample_document_unavailable');
    return {
      id: SAMPLE_DOCUMENT_IDS[kind], uri: asset.localUri,
      name: language === 'en'
        ? `Northline · ${kind === 'bill' ? 'itemized bill' : 'explanation of benefits'}.pdf`
        : `Northline · ${kind === 'bill' ? 'factura detallada' : 'explicación de beneficios'}.pdf`,
      mimeType: 'application/pdf', kind, origin: 'sample' as const, importedAt: at, pageCount: 1,
    };
  }));
}
