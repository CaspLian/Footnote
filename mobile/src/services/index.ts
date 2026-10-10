export { buildDraft, buildSampleFindings, draftService, getCallScript, sampleEntriesChanged } from './local-services';
export * from './sample-assets';
// The backend-aware versions; they fall back to the local ones when EXPO_PUBLIC_API_URL is unset.
export { benchmarkService, documentService } from './connected-services';
export { analyzeDocument, backendConfigured } from './backend';
export { casePatchFromAnalysis } from './backend-mapping';
export { prepareSpeech } from './backend-speech';
export type { DocumentService, BenchmarkService, DraftService, NarrationService } from '../domain/types';
