import type { MicrophoneAccess } from '../services/elevenlabs-conversation';

export async function requestMicrophone(): Promise<MicrophoneAccess> {
  if (globalThis.isSecureContext === false || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return 'insecure';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return 'granted';
  } catch (error) {
    return (error as { name?: string }).name === 'NotFoundError' ? 'no_device' : 'denied';
  }
}
