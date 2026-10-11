import { requestRecordingPermissionsAsync, setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';
import { AudioSession } from '@livekit/react-native';
import type { MicrophoneAccess } from '../services/elevenlabs-conversation';

export async function requestMicrophone(): Promise<MicrophoneAccess> {
  const permission = await requestRecordingPermissionsAsync();
  return permission.granted ? 'granted' : 'denied';
}

export async function activateConversationMicrophone(): Promise<void> {
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true, interruptionMode: 'doNotMix', shouldRouteThroughEarpiece: false });
  await setIsAudioActiveAsync(true);
  await AudioSession.setAppleAudioConfiguration({ audioCategory: 'playAndRecord', audioMode: 'voiceChat', audioCategoryOptions: ['allowBluetooth', 'defaultToSpeaker'] });
}
