import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState, Platform, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { AgentController, agentLanguage, voiceAgentService, type AgentContext } from '@/services/voice-agent';
import { privacyNoticeStore } from '@/services/elevenlabs-conversation';
import { backendConfigured } from '@/services/backend';
import { PushToTalk } from '@/native/push-to-talk';
import type { BillCase } from '@/domain';
import { useFootnoteStore } from '@/store';
import { languageOption } from '@/domain/languages';
import { voiceChoices } from '@/domain/preferences';
import { useTheme, space } from '@/theme';
import { Button, ButtonRow, Feedback, Group, Txt } from './ui';
import { AppSheet } from './sheet';
import { ParticleOrb } from './particle-orb';

export function AgentOrbControl({ billCase, term, collapsed, onCollapsedChange }: { billCase?: BillCase; term?: AgentContext['term']; collapsed: boolean; onCollapsedChange: (collapsed: boolean) => void }) {
  const { colors, reducedMotion } = useTheme();
  const prefs = useFootnoteStore(s => s.preferences); const personalContext = useFootnoteStore(s => s.personalContext); const profiles = useFootnoteStore(s => s.profiles);
  const controller = useMemo(() => new AgentController(voiceAgentService), []);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const privacyNotice = useSyncExternalStore(privacyNoticeStore.subscribe, privacyNoticeStore.get, privacyNoticeStore.get);
  const [open, setOpen] = useState(false);
  const collapseProgress = useSharedValue(0);
  const voiceLevel = useSharedValue(0);
  const captionMotion = useAnimatedStyle(() => ({ opacity: collapsed ? 1 : Math.max(0, 1 - collapseProgress.get() / 40), transform: [{ translateY: collapsed ? 0 : collapseProgress.get() * .35 }] }));
  const active = ['connecting', 'listening', 'thinking', 'speaking'].includes(state.status);
  const language = languageOption(prefs.workingLanguage); const voice = voiceChoices.find(v => v.id === (prefs.voice === 'device' ? 'calm' : prefs.voice))!;
  useEffect(() => { void controller.end(); return () => { void controller.end(); }; }, [controller, billCase?.id, billCase?.updatedAt, billCase?.evidenceContextId, billCase?.entriesEdited, term?.id, prefs.workingLanguage, prefs.voice]);
  useFocusEffect(useMemo(() => () => () => { void controller.end(); }, [controller]));
  // A permission dialog can temporarily background the app while the first call connects.
  useEffect(() => { const sub = AppState.addEventListener('change', next => { if (next !== 'active' && controller.getSnapshot().status !== 'connecting') void controller.end(); }); return () => sub.remove(); }, [controller]);
  useEffect(() => { if (['listening', 'thinking', 'speaking'].includes(state.status) && AppState.currentState && AppState.currentState !== 'active') void controller.end(); }, [controller, state.status]);
  useEffect(() => {
    if (!active || reducedMotion) { voiceLevel.set(0); return; }
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') { voiceLevel.set(0); return; }
      const levels = controller.levels();
      const snapshot = controller.getSnapshot();
      voiceLevel.set(snapshot.status === 'speaking' ? levels.output : snapshot.muted ? 0 : levels.input);
    }, 100);
    return () => { clearInterval(timer); voiceLevel.set(0); };
  }, [active, controller, reducedMotion, voiceLevel]);
  const feedback = useCallback(() => { if (Platform.OS !== 'web' && prefs.haptics) void Haptics.selectionAsync().catch(() => {}); }, [prefs.haptics]);
  const collapse = useCallback(() => { setOpen(false); onCollapsedChange(true); }, [onCollapsedChange]);
  const expand = useCallback(() => { onCollapsedChange(false); }, [onCollapsedChange]);
  function start() {
    feedback();
    setOpen(false);
    const profile = profiles.find(p => p.id === billCase?.profileId);
    void controller.start({ language: prefs.workingLanguage, agentLanguage: agentLanguage(prefs.workingLanguage), voice: voice.id, case: billCase ? { id: billCase.id, evidenceContextId: billCase.evidenceContextId, entriesEdited: billCase.entriesEdited, provider: billCase.provider, serviceDate: billCase.serviceDate, financials: billCase.financials, findings: billCase.findings, reviewMode: billCase.reviewMode } : undefined, evidence: billCase?.attachments.map(a => ({ id: a.id, kind: a.kind, name: a.name })) ?? [], profile: profile ? { firstName: profile.firstName, coverage: profile.coverage, insurer: profile.insurer, planName: profile.planName, zipCode: profile.zipCode } : undefined, preferences: personalContext, term });
  }
  const label = state.status === 'speaking' ? 'Speaking' : state.status === 'listening' ? state.muted ? 'Microphone muted' : 'Listening' : state.status === 'thinking' ? 'Thinking' : state.status === 'connecting' ? 'Connecting…' : '';
  return <>
    <View pointerEvents="box-none" style={{ alignItems: 'center', maxWidth: 320, width: '100%', gap: 2 }}>
      <ParticleOrb status={state.status === 'speaking' ? 'speaking' : state.status === 'connecting' || state.status === 'thinking' ? 'loading' : state.status === 'error' || state.status === 'unavailable' ? 'unavailable' : 'idle'} label={collapsed ? label ? `Show voice agent. ${label}` : 'Show voice agent' : label ? `Open voice agent. ${label}` : 'Open voice agent'} onPress={() => setOpen(true)} onCollapse={collapse} onExpand={expand} collapsed={collapsed} collapseProgress={collapseProgress} level={voiceLevel}/>
      {label || state.error ? <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(180)}><Animated.View style={[{ alignSelf: 'center', maxWidth: 300, paddingHorizontal: 12, paddingVertical: collapsed ? 4 : 6, borderRadius: 12, backgroundColor: colors.background }, captionMotion]}>
        {state.status === 'speaking' && state.caption ? <Txt accessibilityLabel={`Footnote: ${state.caption.text}`} accessibilityLiveRegion={state.caption.final ? 'polite' : 'none'} numberOfLines={collapsed ? 1 : 3} style={{ fontSize: collapsed ? 13 : 15, lineHeight: collapsed ? 19 : 22, textAlign: 'center' }}>{state.caption.text}</Txt> : <Txt variant="caption" accent accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>{label || 'Voice unavailable · Open controls to retry'}</Txt>}
      </Animated.View></Animated.View> : null}
    </View>
    <AppSheet visible={open} title="Talk it through" onClose={() => setOpen(false)} footer={active ? <ButtonRow><Button title={state.muted ? 'Unmute microphone' : 'Mute microphone'} variant="secondary" onPress={() => { feedback(); void controller.toggleMuted(); }} disabled={state.status === 'connecting'} /><Button title="End conversation" onPress={() => { feedback(); void controller.end(); }} /></ButtonRow> : <Button title={state.status === 'error' ? 'Try connecting again' : 'Start conversation'} onPress={start} />}>
      <Group gap={space.sm}><Txt variant="title">Your questions.{'\n'}Your pace.</Txt><Txt muted>{billCase ? 'Ask about the amounts, the evidence behind a question, or what to do next.' : 'Ask for an explanation, an example, or how this term applies to your bill.'}</Txt></Group>
      <Group gap={space.sm}><Txt variant="label">{voice.name} · {language.native}</Txt><Txt variant="caption" muted>{billCase ? billCase.entriesEdited ? 'The saved analysis has different amounts or codes from your corrections. Live voice is paused for this bill.' : billCase.evidenceContextId ? 'The helper uses this bill’s saved analysis. Ask about its charges and questions to clarify.' : 'A saved bill analysis is needed to start a live conversation.' : 'Live conversations are available from a saved bill’s review.'}</Txt></Group>
      {backendConfigured() ? <Txt variant="caption" muted>{privacyNotice}</Txt> : null}
      {label ? <Txt accent accessibilityLiveRegion="polite">{label}</Txt> : null}
      {state.messages.map((m, i) => <Group key={i} gap={space.xs}><Txt variant="label" accent>{m.role === 'user' ? 'You' : 'Footnote'}</Txt><Txt>{m.text}</Txt></Group>)}
      {state.error ? <Feedback danger text={state.error} /> : !backendConfigured() ? <Txt variant="caption" muted>Live voice is unavailable while the app is offline. Connect the backend to talk through a saved bill.</Txt> : null}
      {backendConfigured() && (state.status === 'error' || state.status === 'unavailable') ? <PushToTalk key={`${prefs.workingLanguage}-${voice.id}`} language={prefs.workingLanguage} voice={voice.id} /> : null}
      <ButtonRow><Button title="Choose voice" variant="secondary" onPress={() => { setOpen(false); void controller.end(); router.navigate('/voices'); }} /><Button title="Minimize orb" variant="quiet" onPress={collapse} /></ButtonRow>
    </AppSheet>
  </>;
}
