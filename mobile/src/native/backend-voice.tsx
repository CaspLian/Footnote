import { useEffect, useRef, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Button, Feedback } from '@/components/ui';
import { prepareSpeech } from '../services/backend-speech';

type Status = 'idle' | 'loading' | 'playing' | 'error';

/**
 * Plays the ElevenLabs reading of a saved analysis. The clip is prepared when the analysis arrives (intake) and
 * again when this button appears, and its MP3 is loaded into the player in advance, so pressing it plays at once.
 * Needs expo-audio in the development build.
 */
export function BackendVoiceButton({ auditId }: { auditId: string }) {
  const player = useRef<AudioPlayer | null>(null);
  const finished = useRef(false);
  const [status, setStatus] = useState<Status>('idle');

  function load(url: string): AudioPlayer {
    if (player.current) return player.current;
    const next = createAudioPlayer({ uri: url });
    next.addListener('playbackStatusUpdate', update => {
      if (update.didJustFinish) { finished.current = true; setStatus('idle'); }
    });
    player.current = next;
    return next;
  }

  useEffect(() => {
    let live = true;
    // Warm both ends: the backend's clip and the player's copy of it.
    prepareSpeech(auditId).then(url => { if (live) load(url); }).catch(() => {});
    return () => { live = false; player.current?.remove(); player.current = null; };
  }, [auditId]);

  async function toggle() {
    if (status === 'loading') return;
    if (status === 'playing') {
      player.current?.pause();
      void player.current?.seekTo(0).catch(() => {});
      setStatus('idle');
      return;
    }
    try {
      let ready = player.current;
      if (!ready) {
        // Pressed before the clip was ready: wait for the generation already under way.
        setStatus('loading');
        ready = load(await prepareSpeech(auditId));
      }
      await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
      if (finished.current) { finished.current = false; await ready.seekTo(0).catch(() => {}); }
      ready.play();
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
