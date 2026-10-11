import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Button, ButtonRow, IconButton, Feedback, Group, Screen, Txt } from '@/components/ui';
import { ParticleOrb } from '@/components/particle-orb';
import { LanguagePicker } from '@/components/language-picker';
import { useFootnoteStore } from '@/store';
import { voiceChoices } from '@/domain/preferences';
import { voicePreviewService } from '@/services/voice-preview';
import { backendConfigured, backendLocale } from '@/services/backend';
import { resolveVoiceKey } from '@/services/voice-catalog';
import { useVoiceCatalog } from '@/components/use-voice-catalog';
import { space, useTheme } from '@/theme';

const choices = voiceChoices.filter(v => v.id !== 'device');
export function Voices() {
  const prefs = useFootnoteStore(s => s.preferences);
  const catalog = useVoiceCatalog();
  const { colors, reducedMotion } = useTheme();
  const [initialIndex] = useState(() => Math.max(0, choices.findIndex(v => v.id === prefs.voice)));
  const [index, setIndex] = useState(initialIndex);
  const [pageAnchor, setPageAnchor] = useState(initialIndex);
  const [width, setWidth] = useState(0);
  const [status, setStatus] = useState<'idle'|'loading'|'speaking'>('idle');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(false);
  const pager = useRef<ScrollView>(null);
  const currentIndex = useRef(initialIndex);
  const player = useRef<{ stop(): Promise<void> } | undefined>(undefined);
  const request = useRef(0);
  const previewAbort = useRef<AbortController | undefined>(undefined);

  const feedback = useCallback(() => { if (Platform.OS !== 'web' && prefs.haptics) void Haptics.selectionAsync().catch(() => {}); }, [prefs.haptics]);
  const stop = useCallback(() => { request.current++; previewAbort.current?.abort(); previewAbort.current = undefined; void player.current?.stop(); player.current = undefined; setStatus('idle'); }, []);
  const change = useCallback((next: number) => {
    const n = Math.max(0, Math.min(choices.length - 1, next));
    if (n === currentIndex.current) return;
    currentIndex.current = n;
    feedback(); stop(); setError(''); setSelected(false); setIndex(n);
  }, [feedback, stop]);
  function move(next: number) {
    change(next);
    pager.current?.scrollTo({ x: Math.max(0, Math.min(choices.length - 1, next)) * width, animated: !reducedMotion });
  }
  function settled(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width) change(Math.round(event.nativeEvent.contentOffset.x / width));
  }
  useEffect(() => () => { request.current++; previewAbort.current?.abort(); void player.current?.stop(); }, []);
  useEffect(() => () => { stop(); }, [prefs.workingLanguage, stop]);

  async function preview(voiceId: typeof choices[number]['id']) {
    if (status !== 'idle') { stop(); return; }
    const token = ++request.current;
    const abort = new AbortController(); previewAbort.current = abort;
    setStatus('loading'); setError('');
    try {
      const handle = await voicePreviewService.play(voiceId, prefs.workingLanguage, { signal: abort.signal });
      if (token !== request.current) { await handle.stop(); return; }
      player.current = handle; setStatus('speaking');
      void handle.finished?.then(() => { if (token === request.current) { player.current = undefined; setStatus('idle'); } }).catch(() => { if (token === request.current) { player.current = undefined; setStatus('idle'); setError('The voice preview stopped because audio playback failed. Try again.'); } });
    } catch (e) {
      if (token === request.current) { setStatus('idle'); setError(e instanceof Error ? e.message : 'The preview couldn’t play. Try again.'); }
    }
  }
  // Native paging owns drag tracking, deceleration and interruption. The decorative orb never captures a swipe.
  return <View style={{ flex: 1, backgroundColor: colors.background }} onLayout={event => { const nextWidth = event.nativeEvent.layout.width; if (nextWidth !== width) { setPageAnchor(currentIndex.current); setWidth(nextWidth); } }}>
    {width > 0 ? <ScrollView key={width} ref={pager} horizontal pagingEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} contentOffset={{ x: pageAnchor * width, y: 0 }} onScrollBeginDrag={stop} onMomentumScrollEnd={settled} style={{ flex: 1 }} contentContainerStyle={{ alignItems: 'stretch' }}>
      {choices.map((voice, page) => <View key={voice.id} style={{ width, height: '100%', flexShrink: 0 }} accessibilityElementsHidden={page !== index} importantForAccessibility={page === index ? 'auto' : 'no-hide-descendants'} aria-hidden={page !== index}>
        <Screen contentWidth={720} showStorageError={page === index} testID={page === index ? 'voices' : undefined} footer={<Button title={selected && page === index ? `${voice.name} saved` : `Choose ${voice.name}`} onPress={() => { stop(); useFootnoteStore.getState().setPreferences({ voice: voice.id }); setSelected(true); if (router.canGoBack()) router.back(); }} />}>
          <Group gap={space.lg}><Txt variant="title">Find your voice.</Txt><Txt muted>A voice for asking questions and talking through your next step.</Txt></Group>
          <View pointerEvents="none" style={{ alignItems: 'center', paddingVertical: space.lg }}><ParticleOrb size={220} enter={false} interactive={false} active={page === index} status={page === index ? status : 'idle'} label={`${voice.name} voice illustration`} /></View>
          <Group gap={space.sm} style={{ paddingHorizontal: space.md, alignItems: 'center' }}><Txt variant="title" style={{ textAlign: 'center' }}>{voice.name}</Txt><Txt muted style={{ textAlign: 'center' }}>{voice.id === 'calm' ? 'Steady and reassuring. Space to take it in.' : voice.id === 'clear' ? 'Crisp and conversational. Straight to the point.' : 'Gentle and friendly. One step at a time.'}</Txt><Txt variant="caption" muted>{catalog ? (() => { const resolved = catalog.voices.find(v => v.key === resolveVoiceKey(voice.id, backendLocale(prefs.workingLanguage), catalog)); return `ElevenLabs voice · ${resolved?.name ?? 'Language default'}${resolved?.accent ? ` (${resolved.accent})` : ''}`; })() : backendConfigured() ? 'ElevenLabs voice · loading catalog' : 'ElevenLabs agent voice · placeholder'}</Txt></Group>
          <ButtonRow><IconButton label="Previous voice" name="back" disabled={page === 0} onPress={() => move(page - 1)} /><Button title={status === 'idle' || page !== index ? 'Preview voice' : 'Stop preview'} icon={status === 'idle' || page !== index ? 'play' : 'stop'} variant="secondary" onPress={() => void preview(voice.id)} /><IconButton label="Next voice" name="next" disabled={page === choices.length - 1} onPress={() => move(page + 1)} /></ButtonRow>
          <Txt variant="caption" muted style={{ textAlign: 'center' }}>{page + 1} / {choices.length} · Swipe to explore</Txt>
          {error && page === index ? <Feedback text={error} /> : null}
          <Group gap={space.md}><Txt variant="section">Working language</Txt><LanguagePicker value={prefs.workingLanguage} /></Group>
          <Txt variant="caption" muted>{backendConfigured() ? 'Voice previews are in English; readings use your working language.' : 'Voice previews and live conversations use the connected agent’s voice catalog. These names are preferences, not provider voice IDs.'}</Txt>
        </Screen>
      </View>)}
    </ScrollView> : null}
  </View>;
}
