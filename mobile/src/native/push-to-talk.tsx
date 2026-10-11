import { useEffect, useRef, useState } from 'react';
import { AudioModule, createAudioPlayer, RecordingPresets, setAudioModeAsync, useAudioRecorder, type AudioPlayer } from 'expo-audio';
import { Button, Feedback, Group, Txt } from '@/components/ui';
import type { WorkingLanguage } from '../domain/languages';
import type { VoiceChoice } from '../domain/preferences';
import { askRecordedQuestion, type RecordedAnswer } from '../services/recorded-question';
import { backendUrl } from '../services/backend';
import { claimAudio } from '../services/audio-focus';
import { recordingBlob } from './recording-upload';

/** A bounded recording request is kept visibly separate from the live conversation. */
export function PushToTalk({ language, voice }: { language: WorkingLanguage; voice: VoiceChoice }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [status, setStatus] = useState<'idle' | 'preparing' | 'recording' | 'sending' | 'playing'>('idle');
  const [answer, setAnswer] = useState<RecordedAnswer>();
  const [error, setError] = useState('');
  const mounted = useRef(true), abort = useRef<AbortController | undefined>(undefined), player = useRef<AudioPlayer | undefined>(undefined), release = useRef<(() => void) | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sending = useRef(false);
  function stopPlayback() { player.current?.pause(); release.current?.(); release.current = undefined; setStatus('idle'); }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timer.current); abort.current?.abort(); release.current?.(); player.current?.remove(); void recorder.stop().catch(() => {}); }; }, [recorder]);
  async function start() {
    if (status !== 'idle' && status !== 'playing') return;
    stopPlayback(); setStatus('preparing'); setError('');
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!mounted.current) return;
      if (!permission.granted) throw new Error('Microphone access is needed to record a question. Allow it in your device settings, then try again.');
      release.current = claimAudio({ stop: () => { clearTimeout(timer.current); void recorder.stop().catch(() => {}); if (mounted.current) setStatus('idle'); } });
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      if (!mounted.current) { await recorder.stop(); return; }
      recorder.record(); setStatus('recording');
      timer.current = setTimeout(() => { void send(); }, 30_000);
    } catch (e) { release.current?.(); release.current = undefined; if (mounted.current) { setStatus('idle'); setError(e instanceof Error ? e.message : 'The microphone could not start. Try again.'); } }
  }
  async function send() {
    if (sending.current || !mounted.current) return;
    sending.current = true;
    clearTimeout(timer.current); setStatus('sending');
    try {
      await recorder.stop(); release.current?.(); release.current = undefined;
      if (!recorder.uri) throw new Error('The recording was empty. Record another question.');
      const recording = await recordingBlob(recorder.uri);
      const next = new AbortController(); abort.current = next;
      const result = await askRecordedQuestion(recording, language, voice, next.signal);
      if (!mounted.current || next.signal.aborted) return;
      setAnswer(result); setStatus('idle');
      if (!result.speech.ok) setError(result.speech.error_message ?? 'The spoken reply is unavailable. You can read the answer below.');
    } catch (e) { if (mounted.current && !abort.current?.signal.aborted) { setStatus('idle'); setError(e instanceof Error ? e.message : 'The question could not be answered. Try again.'); } }
    finally { sending.current = false; await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {}); }
  }
  async function listen() {
    if (status === 'playing') { stopPlayback(); return; }
    if (!answer?.speech.audio_url) return;
    player.current?.remove();
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    const ready = createAudioPlayer({ uri: backendUrl(answer.speech.audio_url) }); player.current = ready;
    ready.addListener('playbackStatusUpdate', update => { if (update.didJustFinish && mounted.current) stopPlayback(); });
    release.current = claimAudio({ stop: stopPlayback }); ready.play(); setStatus('playing');
  }
  return <Group>
    <Txt variant="label">Ask a recorded question</Txt>
    <Txt variant="caption" muted>Record up to 30 seconds. This sends your question for a separate answer; it does not include this bill.</Txt>
    <Button title={status === 'recording' ? 'Stop recording and send question' : 'Record a question'} icon={status === 'recording' ? 'stop' : 'speaker'} loading={status === 'preparing' || status === 'sending'} onPress={() => { if (status === 'recording') void send(); else void start(); }} />
    {answer ? <Group><Txt selectable>You: {answer.transcript.text}</Txt>{answer.transcript.needs_confirmation ? <Txt variant="caption" muted>Check the transcript: some words may need correction.</Txt> : null}<Txt selectable>{answer.analysis.result.plain_summary}</Txt>{answer.speech.ok && answer.speech.audio_url ? <Button variant="quiet" title={status === 'playing' ? 'Stop recorded reply' : 'Listen to recorded reply'} onPress={() => { void listen().catch(() => setError('The recorded reply could not be played. Read the answer above.')); }} /> : null}</Group> : null}
    {error ? <Feedback text={error} /> : null}
  </Group>;
}
