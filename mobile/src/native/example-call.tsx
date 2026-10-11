import { useEffect, useRef, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Button, Card, Feedback, Group, Txt } from '@/components/ui';
import { useTranslation } from '@/localization/use-translation';
import { space } from '@/theme';
import type { VoiceChoice } from '../domain/preferences';
import { backendUrl } from '../services/backend';
import { requestExampleCall, type ExampleCall } from '../services/example-call';
import { voiceKeyFor } from '../services/voice-catalog';
import { claimAudio } from '../services/audio-focus';

/** Two ElevenLabs voices act out how the call could go, in the user's language. Asked for as the screen opens, so it
 *  is usually ready by the time the person presses Play. */
export function ExampleCallCard({ auditId, voice, locale, counterpart }: { auditId: string; voice: VoiceChoice; locale: string; counterpart: ExampleCall['counterpart'] }) {
  const { t } = useTranslation();
  const [retry, setRetry] = useState(0);
  const request = `${auditId}|${voice}|${locale}|${counterpart}|${retry}`;
  // What the latest finished request returned; a result for an older request means the new one is still preparing.
  const [loaded, setLoaded] = useState<{ request: string; example?: ExampleCall }>();
  const [playing, setPlaying] = useState(false);
  const player = useRef<AudioPlayer | null>(null);
  const releaseAudio = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    const abort = new AbortController();
    void voiceKeyFor(voice, locale)
      .then(key => requestExampleCall(auditId, locale, key, counterpart, abort.signal))
      .then(example => { if (!abort.signal.aborted) setLoaded({ request, example }); })
      .catch(() => { if (!abort.signal.aborted) setLoaded({ request }); });
    return () => { abort.abort(); releaseAudio.current?.(); releaseAudio.current = undefined; player.current?.remove(); player.current = null; };
  }, [auditId, voice, locale, counterpart, request]);
  const current = loaded?.request === request ? loaded : undefined;
  const example = current?.example;
  function stop() { releaseAudio.current?.(); releaseAudio.current = undefined; player.current?.pause(); void player.current?.seekTo(0).catch(() => {}); setPlaying(false); }
  async function toggle() {
    if (playing) { stop(); return; }
    if (!example) return;
    try {
      if (!player.current) {
        const next = createAudioPlayer({ uri: backendUrl(example.audio_url) });
        next.addListener('playbackStatusUpdate', update => { if (update.didJustFinish) { releaseAudio.current?.(); releaseAudio.current = undefined; void next.seekTo(0).catch(() => {}); setPlaying(false); } });
        player.current = next;
      }
      releaseAudio.current = claimAudio({ stop });
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      player.current.play(); setPlaying(true);
    } catch { releaseAudio.current?.(); releaseAudio.current = undefined; setPlaying(false); setLoaded({ request }); }
  }
  const them = counterpart === 'insurer' ? t('Insurer') : t('Billing office');
  return <Card><Group gap={space.md}>
    <Txt variant="section">{t('Hear an example call')}</Txt>
    <Txt muted>{t('Two ElevenLabs voices act out how this call could go, in your language. It is an example to practice with, not what the office will say.')}</Txt>
    {current && !example
      ? <Feedback danger text={t('The example call could not be prepared. Your call script above still works.')} action={{ title: t('Try again'), onPress: () => setRetry(v => v + 1) }} />
      : <Button variant="secondary" icon={playing ? 'stop' : 'play'} loading={!current} disabled={!current}
          title={!current ? t('Preparing the example call…') : playing ? t('Stop the example call') : t('Play the example call')} onPress={() => void toggle()} />}
    {example ? <Group gap={space.sm}>{example.turns.map((turn, index) => <Txt key={index} selectable translate={false}>
      <Txt variant="caption" muted translate={false}>{turn.speaker === 'patient' ? t('You') : them}: </Txt>{turn.text}
    </Txt>)}</Group> : null}
  </Group></Card>;
}
