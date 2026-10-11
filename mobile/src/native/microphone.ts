import { requestRecordingPermissionsAsync } from 'expo-audio';
import type { MicrophoneAccess } from '../services/elevenlabs-conversation';

export async function requestMicrophone(): Promise<MicrophoneAccess> {
  const permission = await requestRecordingPermissionsAsync();
  return permission.granted ? 'granted' : 'denied';
}
