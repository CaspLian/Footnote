import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Button, ButtonRow, IconButton, Feedback, Group, Screen, Txt } from '@/components/ui';
import { ParticleOrb } from '@/components/particle-orb';
import { LanguagePicker } from '@/components/language-picker';
import { useUnfoldStore } from '@/store';
import { voiceChoices } from '@/domain/preferences';
import { voicePreviewService } from '@/services/voice-preview';
import { space } from '@/theme';
const choices = voiceChoices.filter(v => v.id !== 'device');
export function Voices() {
  const prefs = useUnfoldStore(s => s.preferences);
  const [index, setIndex] = useState(Math.max(0, choices.findIndex(v => v.id === prefs.voice)));
  const [width, setWidth] = useState(Math.min(useWindowDimensions().width - 48, 672));
  const [status, setStatus] = useState<'idle'|'loading'|'speaking'>('idle');
  const [error, setError] = useState(''); const [selected, setSelected] = useState(false);
  const scroll = useRef<ScrollView>(null); const player = useRef<{ stop(): Promise<void> } | undefined>(undefined); const request = useRef(0);
  const [initialOffset] = useState(() => ({ x: index * width, y: 0 }));
  const voice = choices[index];
  function feedback() { if (Platform.OS !== 'web' && prefs.haptics) void Haptics.selectionAsync().catch(() => {}); }
  function stop() { request.current++; void player.current?.stop(); player.current = undefined; setStatus('idle'); }

  useEffect(() => () => { request.current++; void player.current?.stop(); }, []);
  async function preview() { feedback(); if (status !== 'idle') { stop(); return; } const token = ++request.current; setStatus('loading'); setError(''); try { const handle = await voicePreviewService.play(voice.id, prefs.workingLanguage); if (token !== request.current) { await handle.stop(); return; } player.current = handle; setStatus('speaking'); } catch (e) { if (token === request.current) { setStatus('idle'); setError(e instanceof Error ? e.message : 'The sample couldn’t play. Try again.'); } } }
  function change(next: number) { feedback(); stop(); const n = Math.max(0, Math.min(choices.length - 1, next)); setError(''); setSelected(false); setIndex(n); scroll.current?.scrollTo({ x: n * width, animated: !prefs.reduceMotion }); }
  return <Screen contentWidth={720} testID="voices" footer={<Button title={selected ? `${voice.name} saved` : `Choose ${voice.name}`} onPress={() => { feedback(); stop(); useUnfoldStore.getState().setPreferences({ voice: voice.id }); setSelected(true); if (router.canGoBack()) router.back(); }} />}>
    <Group gap={space.lg}><Txt variant="title">Find your voice.</Txt><Txt muted>A voice for asking questions and talking through your next step.</Txt></Group>
    <View style={{ alignItems: 'center', paddingVertical: space.lg }}><ParticleOrb size={220} enter={false} status={status} label={`Preview ${voice.name} voice`} onPress={() => void preview()} /></View>
    <View onLayout={event => { const next = event.nativeEvent.layout.width; if (next !== width) { setWidth(next); requestAnimationFrame(() => scroll.current?.scrollTo({ x: index * next, animated: false })); } }} style={{ width: '100%', overflow: 'hidden' }}>
      <ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={initialOffset} scrollEventThrottle={32} onScroll={event => { const next = Math.round(event.nativeEvent.contentOffset.x / width); if (next >= 0 && next < choices.length && next !== index) { stop(); setError(''); setIndex(next); setSelected(false); } }}>
        {choices.map(v => <Group key={v.id} gap={space.sm} style={{ width, paddingHorizontal: space.md, alignItems: 'center' }}><Txt variant="title" style={{ textAlign: 'center' }}>{v.name}</Txt><Txt muted style={{ textAlign: 'center' }}>{v.id === 'calm' ? 'Steady and reassuring. Space to take it in.' : v.id === 'clear' ? 'Crisp and conversational. Straight to the point.' : 'Gentle and friendly. One step at a time.'}</Txt><Txt variant="caption" muted>ElevenLabs agent voice · placeholder</Txt></Group>)}
      </ScrollView>
    </View>
    <ButtonRow><IconButton label="Previous voice" name="back" disabled={index === 0} onPress={() => change(index - 1)} /><Button title={status === 'idle' ? 'Preview voice' : 'Stop preview'} icon={status === 'idle' ? 'play' : 'stop'} variant="secondary" onPress={() => void preview()} /><IconButton label="Next voice" name="next" disabled={index === choices.length - 1} onPress={() => change(index + 1)} /></ButtonRow>
    <Txt variant="caption" muted style={{ textAlign: 'center' }}>{index + 1} / {choices.length} · Swipe to explore</Txt>
    {error ? <Feedback text={error} /> : null}
    <Group gap={space.md}><Txt variant="section">Working language</Txt><LanguagePicker value={prefs.workingLanguage} /></Group>
    <Txt variant="caption" muted>Voice samples and live conversations will use the connected agent’s voice catalog. These names are preferences, not provider voice IDs.</Txt>
  </Screen>;
}
