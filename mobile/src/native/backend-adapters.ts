import { backendConfigured } from '../services/backend';
import { configureUnderstandingAdapter } from '../services/document-understanding';
import { createGeminiUnderstanding } from '../services/gemini-understanding';
import { configureVoicePreviewAdapter } from '../services/voice-preview';
import { appendAttachmentToForm } from './documents';
import { voiceSamplePreview } from './voice-sample-player';
import { installLiveVoiceAgent } from './live-agent';
import { useFootnoteStore } from '../store';
export function installBackendAdapters() {
  if (!backendConfigured()) return;
  configureUnderstandingAdapter(createGeminiUnderstanding({ appendPart: appendAttachmentToForm, currentVoice: () => useFootnoteStore.getState().preferences.voice, markDateRecovery: caseId => useFootnoteStore.getState().markDateRecoveryAttempt(caseId) }));
  configureVoicePreviewAdapter(voiceSamplePreview);
  installLiveVoiceAgent();
}
