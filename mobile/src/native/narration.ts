import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';
import * as Speech from 'expo-speech';
import type { Language, NarrationService } from '@/domain';
import { nativeErrorMessage } from './errors';
import { NarrationController } from './narration-controller';

const controller = new NarrationController({
  getVoices: Speech.getAvailableVoicesAsync,
  stop: Speech.stop,
  maxLength: Speech.maxSpeechInputLength,
  start: (text, options) => Speech.speak(text, { ...options, rate: 0.92, useApplicationAudioSession: false }),
});

export const narrationService: NarrationService = {
  speak: (text, language) => controller.speak(text, language),
  stop: () => controller.stop(),
};

/** Mount once in the root layout so tab navigation, backgrounding and language changes stop speech. */
export function useNarrationInterruptions(language: Language) {
  const pathname = usePathname();
  useEffect(() => {
    void narrationService.stop().catch(() => {});
    return () => { void narrationService.stop().catch(() => {}); };
  }, [language, pathname]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') void narrationService.stop().catch(() => {});
    });
    return () => {
      subscription.remove();
      void narrationService.stop().catch(() => {});
    };
  }, []);
}

export function useNarration(language: Language) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const play = useCallback(async (text: string) => {
    try { await narrationService.speak(text, language); } catch { /* The reactive status carries the localized recovery. */ }
  }, [language]);
  const stop = useCallback(async () => {
    try { await narrationService.stop(); } catch { /* Route cleanup must remain possible without audio. */ }
  }, []);
  useEffect(() => () => { void narrationService.stop().catch(() => {}); }, []);
  return {
    status: snapshot.status,
    error: snapshot.error ? nativeErrorMessage(snapshot.error, language) : undefined,
    play,
    stop,
  };
}
