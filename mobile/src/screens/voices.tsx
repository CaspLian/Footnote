import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Button, ButtonRow, IconButton, Feedback, Group, Screen, Txt } from '@/components/ui';
import { ParticleOrb } from '@/components/particle-orb';
import { useFootnoteStore } from '@/store';
import type { VoiceChoice } from '@/domain/preferences';
import { voicePreviewService } from '@/services/voice-preview';
import { backendConfigured, backendLocale, type BackendVoiceCatalog } from '@/services/backend';
import { accentFor, resolveVoiceKey, voicesForLocale } from '@/services/voice-catalog';
import { useVoiceCatalogState } from '@/components/use-voice-catalog';
import { useTranslation } from '@/localization/use-translation';
import { space, useTheme } from '@/theme';

export function Voices() {
  const language = useFootnoteStore(s => s.preferences.workingLanguage);
  const [revision, setRevision] = useState(0);
  const { catalog, error } = useVoiceCatalogState(revision);
  const { colors } = useTheme();
  if (!catalog?.voices.length) return <Screen footer={<Button title="Choose voice" disabled onPress={() => {}}/>}><Txt variant="title">Choose a voice</Txt><Group gap={space.lg} style={{ alignItems: 'center', paddingVertical: 40 }}>{backendConfigured() && !error ? <ActivityIndicator color={colors.accent}/> : null}<Txt muted>{error || (backendConfigured() ? 'Loading available voices' : 'Connect to Footnote to choose a voice.')}</Txt><Button title="Reload voices" variant="secondary" onPress={() => setRevision(v => v + 1)}/></Group></Screen>;
  return <AvailableVoices key={language} catalog={catalog}/>;
}
function AvailableVoices({ catalog }: { catalog: BackendVoiceCatalog }) {
  const prefs = useFootnoteStore(s => s.preferences); const { t } = useTranslation();
  const choices = voicesForLocale(backendLocale(prefs.workingLanguage), catalog).map(v => ({ ...v, id: `provider:${v.key}` as VoiceChoice }));
  const { reducedMotion } = useTheme();
  const [initialIndex] = useState(() => Math.max(0, choices.findIndex(v => v.key === resolveVoiceKey(prefs.voice, backendLocale(prefs.workingLanguage), catalog))));
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
  }, [feedback, stop, choices.length]);
  function move(next: number) {
    change(next);
    pager.current?.scrollTo({ x: Math.max(0, Math.min(choices.length - 1, next)) * width, animated: !reducedMotion });
  }
  function settled(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width) change(Math.round(event.nativeEvent.contentOffset.x / width));
  }
  useEffect(() => () => { request.current++; previewAbort.current?.abort(); void player.current?.stop(); }, []);
  useEffect(() => () => { stop(); }, [prefs.workingLanguage, stop]);

  async function preview(voiceId: VoiceChoice) {
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
  const selectedVoice = choices[index];
  return <Screen testID="voices" contentWidth={720} footer={<Button title={selected && selectedVoice ? t('{0} saved', {0:selectedVoice.name}) : selectedVoice ? t('Choose {0}', {0:selectedVoice.name}) : 'Choose voice'} disabled={!selectedVoice} onPress={() => { if (!selectedVoice) return; stop(); useFootnoteStore.getState().setPreferences({ voice: selectedVoice.id }); setSelected(true); if (router.canGoBack()) router.back(); }} />}>
    <Group gap={space.lg}><Txt variant="title">Choose a voice</Txt><Txt muted>Preview a voice for your conversations.</Txt></Group>

    <View onLayout={event => { const nextWidth = event.nativeEvent.layout.width; if (nextWidth !== width) { setPageAnchor(currentIndex.current); setWidth(nextWidth); } }} style={{ minHeight: choices.length ? 420 : 0 }}>
      {width > 0 && choices.length ? <ScrollView key={`${width}-${prefs.workingLanguage}`} ref={pager} horizontal pagingEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} contentOffset={{ x: pageAnchor * width, y: 0 }} onScrollBeginDrag={stop} onMomentumScrollEnd={settled} style={{ flexGrow: 0 }} contentContainerStyle={{ alignItems: 'stretch' }}>
        {choices.map((voice, page) => <View key={voice.id} style={{ width, flexShrink: 0, gap: space.lg, paddingVertical: space.sm }} accessibilityElementsHidden={page !== index} importantForAccessibility={page === index ? 'auto' : 'no-hide-descendants'} aria-hidden={page !== index}>
          <View pointerEvents="none" style={{ alignItems: 'center', paddingVertical: space.sm }}><ParticleOrb size={200} enter={false} interactive={false} active={page === index} status={page === index ? status : 'idle'} label={`${voice.name} voice illustration`} /></View>
          <Group gap={space.sm} style={{ paddingHorizontal: space.md, alignItems: 'center' }}><Txt variant="title" translate={false} style={{ textAlign: 'center' }}>{voice.name}</Txt><Txt variant="caption" muted translate={false}>{[accentFor(voice, backendLocale(prefs.workingLanguage)) ? t('{0} accent', { 0: accentFor(voice, backendLocale(prefs.workingLanguage))! }) : undefined, voice.source?.includes('Voice Library') ? 'ElevenLabs Voice Library' : 'ElevenLabs'].filter(Boolean).join(' · ')}</Txt></Group>
          <ButtonRow><IconButton label="Previous voice" name="back" disabled={page === 0} onPress={() => move(page - 1)} /><Button title={status === 'idle' || page !== index ? 'Preview voice' : status === 'loading' ? 'Cancel preview' : 'Stop preview'} icon={status === 'idle' || page !== index ? 'play' : 'stop'} variant="secondary" loading={false} onPress={() => void preview(voice.id)} /><IconButton label="Next voice" name="next" disabled={page === choices.length - 1} onPress={() => move(page + 1)} /></ButtonRow>
        </View>)}
      </ScrollView> : null}
    </View>
    {selectedVoice ? <Txt variant="caption" muted style={{ textAlign: 'center' }}>{index + 1} / {choices.length} · Swipe to explore</Txt> : null}
    {!choices.length ? <Group gap={space.lg}><Txt variant="section">No verified voices available</Txt><Txt muted>There are no ElevenLabs voices verified for this language in the connected catalog.</Txt><Button title="Change language" variant="secondary" onPress={() => router.navigate('/languages')} /></Group> : null}
    {error ? <Feedback text={error} /> : null}
    <Txt variant="caption" muted>Each preview speaks your working language, with the accent ElevenLabs verified for this voice.</Txt>
  </Screen>;
}
