import { useEffect, useRef, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Button, Feedback } from '@/components/ui';
import type { VoiceChoice } from '../domain/preferences';
import { prepareSpeech } from '../services/backend-speech';
import { voiceKeyFor } from '../services/voice-catalog';
import { claimAudio } from '../services/audio-focus';

type Status = 'idle' | 'loading' | 'playing' | 'error';
export function BackendVoiceButton({ auditId, voice, language }: { auditId: string; voice: VoiceChoice; language: string }) {
  const player = useRef<AudioPlayer | null>(null);
  const finished = useRef(false);
  const changing = useRef(false);
  const revision = useRef(0);
  const releaseAudio = useRef<(() => void) | undefined>(undefined);
  const [status, setStatus] = useState<Status>('idle');
  const [retry, setRetry] = useState(0);
  function stop() { releaseAudio.current?.(); releaseAudio.current = undefined; player.current?.pause(); void player.current?.seekTo(0).catch(() => {}); setStatus('idle'); }
  async function load(token: number) {
    const key = await voiceKeyFor(voice, language);
    const url = await prepareSpeech(auditId, key);
    if (token !== revision.current) return undefined;
    if (!player.current) {
      const next = createAudioPlayer({ uri: url });
      next.addListener('playbackStatusUpdate', update => { if (token === revision.current && update.didJustFinish) { finished.current = true; releaseAudio.current?.(); releaseAudio.current = undefined; setStatus('idle'); } });
      player.current = next;
    }
    return player.current;
  }
  useEffect(() => {
    const token = ++revision.current;
    finished.current = false;
    void load(token).then(() => { if (token === revision.current) setStatus('idle'); }).catch(() => { if (token === revision.current) setStatus('error'); });
    return () => { revision.current = token + 1; releaseAudio.current?.(); releaseAudio.current = undefined; player.current?.remove(); player.current = null; };
    // The effect owns playback for this saved analysis and selected voice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId, voice, language, retry]);
  async function toggle() {
    if (status === 'loading' || changing.current) return;
    if (status === 'playing') { stop(); return; }
    changing.current = true;
    const token = revision.current; setStatus('loading');
    try {
      const ready = player.current ?? await load(token);
      if (!ready || token !== revision.current) return;
      releaseAudio.current = claimAudio({ stop });
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      if (token !== revision.current) return;
      if (finished.current) { finished.current = false; await ready.seekTo(0); }
      ready.play(); setStatus('playing');
    } catch { if (token === revision.current) { releaseAudio.current?.(); releaseAudio.current = undefined; setStatus('error'); } }
    finally { changing.current = false; }
  }
  return <>
    <Button variant="quiet" icon={status === 'playing' ? 'stop' : 'speaker'} loading={status === 'loading'} title={status === 'playing' ? 'Stop the ElevenLabs voice' : 'Listen with the ElevenLabs voice'} onPress={() => void toggle()} />
    {status === 'error' ? <Feedback danger text="The ElevenLabs voice could not be played. Read the summary above, or try again." action={{ title: 'Try again', onPress: () => setRetry(v => v + 1) }} onDismiss={() => setStatus('idle')} /> : null}
  </>;
}
