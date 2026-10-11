import { throwIfAborted } from '../services/abort-signal';
import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync, type AudioPlayer } from 'expo-audio';
import { backendLocale, voiceSampleUrl } from '../services/backend';
import { voiceKeyFor } from '../services/voice-catalog';
import { claimAudio } from '../services/audio-focus';
import type { VoicePreviewAdapter } from '../services/voice-preview';
import { waitForAudio } from '../services/audio-ready';
export const voiceSamplePreview: VoicePreviewAdapter = { async play(voice, language, { signal } = {}) {
  const key = await voiceKeyFor(voice, backendLocale(language));
  if (!key) throw new Error('The voice list could not be loaded from the Footnote backend. Check the connection and try again.');
  throwIfAborted(signal);
  let player: AudioPlayer | undefined;
  let released = false; let releaseAudio: (() => void) | undefined;
  let finish!: () => void;
  let fail!: (error: Error) => void;
  const finished = new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; });
  void finished.catch(() => {}); // A native error can arrive before the caller receives the handle.
  let subscription: { remove(): void } | undefined;
  const stop = async () => { if (released) return; released = true; releaseAudio?.(); signal?.removeEventListener('abort', cancel); subscription?.remove(); try { player?.pause(); } finally { player?.remove(); finish(); } };
  const cancel = () => { void stop(); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    releaseAudio = claimAudio({ stop: () => { void stop(); } });
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, shouldRouteThroughEarpiece: false, interruptionMode: 'doNotMix' });
    await setIsAudioActiveAsync(true);
    throwIfAborted(signal);
    if (released) throw new Error('Voice preview cancelled.');
    player = createAudioPlayer({ uri: voiceSampleUrl(key) }, { downloadFirst: true, updateInterval: 100 });
    player.volume = 1; player.muted = false;
    subscription = player.addListener('playbackStatusUpdate', status => {
      if (status.error) { fail(new Error('Voice playback failed.')); void stop(); }
      else if (status.didJustFinish) void stop();
    });
    await waitForAudio(player, 'loaded', 30_000, signal);
    throwIfAborted(signal);
    if (released) throw new Error('Voice preview cancelled.');
    const started = waitForAudio(player, 'playing', 6_000, signal);
    player.play();
    await started;
    return { stop, finished };
  } catch (error) { await stop(); throw error; }
} };
