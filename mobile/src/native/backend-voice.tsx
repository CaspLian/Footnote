import { useEffect, useRef, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Button, Feedback } from '@/components/ui';
import { backendUrl, speakAnalysis } from '../services/backend';

type Status = 'idle' | 'loading' | 'playing' | 'error';

/**
 * Plays the ElevenLabs reading of a saved analysis: POST /api/v1/voice/speak, then the MP3 it names. The same
 * analysis in the same voice comes from the backend's cache, free. Needs expo-audio in the development build.
 */
export function BackendVoiceButton({ auditId }: { auditId: string }) {
  const player = useRef<AudioPlayer | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  useEffect(() => () => { player.current?.remove(); player.current = null; }, []);
  async function toggle() {
    if (status === 'loading') return;
    if (status === 'playing') { player.current?.pause(); setStatus('idle'); return; }
    setStatus('loading');
    try {
      const speech = await speakAnalysis(auditId);
      if (!speech.ok || !speech.audio_url) throw new Error(speech.error_code ?? 'no_audio');
      await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
      player.current?.remove();
      const next = createAudioPlayer({ uri: backendUrl(speech.audio_url) });
      next.addListener('playbackStatusUpdate', update => { if (update.didJustFinish) setStatus('idle'); });
      player.current = next;
      next.play();
      setStatus('playing');
    } catch {
      setStatus('error');
    }
  }
  return <>
    <Button variant="quiet" icon={status === 'playing' ? 'stop' : 'speaker'} loading={status === 'loading'} title={status === 'playing' ? 'Stop the ElevenLabs voice' : 'Listen with the ElevenLabs voice'} onPress={() => void toggle()} />
    {status === 'error' ? <Feedback danger text="The ElevenLabs voice could not be played. Read the summary above, or try again." /> : null}
  </>;
}
