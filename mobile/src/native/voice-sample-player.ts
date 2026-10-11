import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { backendLocale, voiceSampleUrl } from '../services/backend';
import { voiceKeyFor } from '../services/voice-catalog';
import { claimAudio } from '../services/audio-focus';
import type { VoicePreviewAdapter } from '../services/voice-preview';
export const voiceSamplePreview: VoicePreviewAdapter = { async play(voice, language) {
  const key = await voiceKeyFor(voice, backendLocale(language));
  if (!key) throw new Error('The voice list could not be loaded from the ClaimPulse backend. Check the connection and try again.');
  await setAudioModeAsync({ playsInSilentMode: true });
  const player = createAudioPlayer({ uri: voiceSampleUrl(key) });
  let released = false; let releaseAudio: (() => void) | undefined;
  let finish!: () => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  const stop = async () => { if (released) return; released = true; releaseAudio?.(); player.pause(); player.remove(); finish(); };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let subscription: ReturnType<typeof player.addListener> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('This voice sample could not be loaded. Try again.')), 15_000);
      subscription = player.addListener('playbackStatusUpdate', status => { if (status.isLoaded) resolve(); if (status.didJustFinish) void stop(); });
      if (player.isLoaded) resolve();
    });
    clearTimeout(timer);
    releaseAudio = claimAudio({ stop: () => { void stop(); } });
    player.play();
    void finished.then(() => subscription?.remove());
    return { stop, finished };
  } catch (error) { clearTimeout(timer); subscription?.remove(); await stop(); throw error; }
} };
