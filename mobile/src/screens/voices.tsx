import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Button, ButtonRow, IconButton, Feedback, Group, Screen, Txt } from '@/components/ui';
import { ParticleOrb } from '@/components/particle-orb';
import { LanguagePicker } from '@/components/language-picker';
import { useUnfoldStore } from '@/store';
import { voiceChoices } from '@/domain/preferences';
import { voicePreviewService } from '@/services/voice-preview';
import { space, useTheme } from '@/theme';
const choices = voiceChoices.filter(v => v.id !== 'device');
export function Voices() {
  const prefs = useUnfoldStore(s => s.preferences);
  const { reducedMotion } = useTheme();
  const [index, setIndex] = useState(Math.max(0, choices.findIndex(v => v.id === prefs.voice)));
  const [status, setStatus] = useState<'idle'|'loading'|'speaking'>('idle');
  const [error, setError] = useState(''); const [selected, setSelected] = useState(false);
  const player = useRef<{ stop(): Promise<void> } | undefined>(undefined); const request = useRef(0);
  const drag = useSharedValue(0), dragStart = useSharedValue(0);
  const voice = choices[index];
  const feedback = useCallback(() => { if (Platform.OS !== 'web' && prefs.haptics) void Haptics.selectionAsync().catch(() => {}); }, [prefs.haptics]);
  const stop = useCallback(() => { request.current++; void player.current?.stop(); player.current = undefined; setStatus('idle'); }, []);
  const change = useCallback((next: number) => { const n = Math.max(0, Math.min(choices.length - 1, next)); feedback(); stop(); setError(''); setSelected(false); setIndex(n); }, [feedback, stop]);
  const swipe = useMemo(() => Gesture.Pan().activeOffsetX([-22, 22]).failOffsetY([-14, 14])
    .onStart(() => { dragStart.set(drag.get()); })
    .onUpdate(event => { if (!reducedMotion) drag.set(Math.max(-40, Math.min(40, dragStart.get() + event.translationX * .2))); })
    // This listener schedules the ref-owning action after a gesture; the builder never calls it during render.
    // eslint-disable-next-line react-hooks/refs
    .onEnd(event => {
      const projected = event.translationX + event.velocityX * .12;
      const next = projected < -50 ? index + 1 : projected > 50 ? index - 1 : index;
      if (next !== index && next >= 0 && next < choices.length) scheduleOnRN(change, next);
      drag.set(withSpring(0, { duration: reducedMotion ? 0 : 300, dampingRatio: .8, velocity: event.velocityX * .2 }));
    }).onFinalize((_event, success) => { if (!success) drag.set(withSpring(0, { duration: reducedMotion ? 0 : 300, dampingRatio: .8 })); }), [index, change, drag, dragStart, reducedMotion]);
  const pageMotion = useAnimatedStyle(() => ({ transform: [{ translateX: drag.get() }] }));

  useEffect(() => () => { request.current++; void player.current?.stop(); }, []);
  async function preview() { feedback(); if (status !== 'idle') { stop(); return; } const token = ++request.current; setStatus('loading'); setError(''); try { const handle = await voicePreviewService.play(voice.id, prefs.workingLanguage); if (token !== request.current) { await handle.stop(); return; } player.current = handle; setStatus('speaking'); } catch (e) { if (token === request.current) { setStatus('idle'); setError(e instanceof Error ? e.message : 'The sample couldn’t play. Try again.'); } } }
  return <GestureDetector gesture={swipe}><View collapsable={false} style={{ flex: 1 }}><Screen contentWidth={720} testID="voices" footer={<Button title={selected ? `${voice.name} saved` : `Choose ${voice.name}`} onPress={() => { feedback(); stop(); useUnfoldStore.getState().setPreferences({ voice: voice.id }); setSelected(true); if (router.canGoBack()) router.back(); }} />}>
    <Group gap={space.lg}><Txt variant="title">Find your voice.</Txt><Txt muted>A voice for asking questions and talking through your next step.</Txt></Group>
    <Animated.View style={[{ gap: space.lg }, pageMotion]}>
      <View pointerEvents="none" style={{ alignItems: 'center', paddingVertical: space.lg }}><ParticleOrb size={220} enter={false} interactive={false} status={status} label={`${voice.name} voice illustration`} /></View>
      <Animated.View key={voice.id} entering={reducedMotion ? undefined : FadeIn.duration(180)}><Group gap={space.sm} style={{ paddingHorizontal: space.md, alignItems: 'center' }}><Txt variant="title" style={{ textAlign: 'center' }}>{voice.name}</Txt><Txt muted style={{ textAlign: 'center' }}>{voice.id === 'calm' ? 'Steady and reassuring. Space to take it in.' : voice.id === 'clear' ? 'Crisp and conversational. Straight to the point.' : 'Gentle and friendly. One step at a time.'}</Txt><Txt variant="caption" muted>ElevenLabs agent voice · placeholder</Txt></Group></Animated.View>
    </Animated.View>
    <ButtonRow><IconButton label="Previous voice" name="back" disabled={index === 0} onPress={() => change(index - 1)} /><Button title={status === 'idle' ? 'Preview voice' : 'Stop preview'} icon={status === 'idle' ? 'play' : 'stop'} variant="secondary" onPress={() => void preview()} /><IconButton label="Next voice" name="next" disabled={index === choices.length - 1} onPress={() => change(index + 1)} /></ButtonRow>
    <Txt variant="caption" muted style={{ textAlign: 'center' }}>{index + 1} / {choices.length} · Swipe to explore</Txt>
    {error ? <Feedback text={error} /> : null}
    <Group gap={space.md}><Txt variant="section">Working language</Txt><LanguagePicker value={prefs.workingLanguage} /></Group>
    <Txt variant="caption" muted>Voice samples and live conversations will use the connected agent’s voice catalog. These names are preferences, not provider voice IDs.</Txt>
  </Screen></View></GestureDetector>;
}
