import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState, Platform, Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { AgentController, agentLanguage, voiceAgentService, type AgentContext } from '@/services/voice-agent';
import type { BillCase } from '@/domain';
import { useUnfoldStore } from '@/store';
import { languageOption } from '@/domain/languages';
import { voiceChoices } from '@/domain/preferences';
import { useTheme, space } from '@/theme';
import { Button, ButtonRow, Feedback, Group, Txt } from './ui';
import { AppSheet } from './sheet';
import { ParticleOrb } from './particle-orb';
import { OrbMark } from './orb-mark';

export function AgentOrbControl({ billCase, term, collapsed, onCollapsedChange }: { billCase?: BillCase; term?: AgentContext['term']; collapsed: boolean; onCollapsedChange: (collapsed: boolean) => void }) {
  const { reducedMotion } = useTheme();
  const prefs = useUnfoldStore(s => s.preferences); const personalContext = useUnfoldStore(s => s.personalContext); const profiles = useUnfoldStore(s => s.profiles);
  const controller = useMemo(() => new AgentController(voiceAgentService), []);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [open, setOpen] = useState(false);
  const active = ['connecting', 'listening', 'thinking', 'speaking'].includes(state.status);
  const language = languageOption(prefs.workingLanguage); const voice = voiceChoices.find(v => v.id === (prefs.voice === 'device' ? 'calm' : prefs.voice))!;
  useEffect(() => { void controller.end(); return () => { void controller.end(); }; }, [controller, billCase?.id, billCase?.updatedAt, term?.id, prefs.workingLanguage, prefs.voice]);
  useFocusEffect(useMemo(() => () => () => { void controller.end(); }, [controller]));
  useEffect(() => { const sub = AppState.addEventListener('change', state => { if (state !== 'active') void controller.end(); }); return () => sub.remove(); }, [controller]);
  function feedback() { if (Platform.OS !== 'web' && prefs.haptics) void Haptics.selectionAsync().catch(() => {}); }
  function collapse() { feedback(); setOpen(false); onCollapsedChange(true); void controller.end(); }
  function start() {
    feedback();
    const profile = profiles.find(p => p.id === billCase?.profileId);
    void controller.start({ language: prefs.workingLanguage, agentLanguage: agentLanguage(prefs.workingLanguage), voice: voice.id, case: billCase ? { id: billCase.id, evidenceContextId: billCase.evidenceContextId, provider: billCase.provider, serviceDate: billCase.serviceDate, financials: billCase.financials, findings: billCase.findings, reviewMode: billCase.reviewMode } : undefined, evidence: billCase?.attachments.map(a => ({ id: a.id, kind: a.kind, name: a.name })) ?? [], profile: profile ? { firstName: profile.firstName, coverage: profile.coverage, insurer: profile.insurer, planName: profile.planName, zipCode: profile.zipCode } : undefined, preferences: personalContext, term });
  }
  const label = state.status === 'speaking' ? 'Speaking' : state.status === 'listening' ? state.muted ? 'Microphone muted' : 'Listening' : state.status === 'thinking' ? 'Thinking' : state.status === 'connecting' ? 'Connecting…' : '';
  return <>
    {collapsed ? <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(220)} exiting={reducedMotion ? undefined : FadeOutDown.duration(180)}><Pressable accessibilityRole="button" accessibilityLabel="Show voice agent" onPress={() => { feedback(); onCollapsedChange(false); }} style={{ width: 132, height: 64, alignItems: 'center', justifyContent: 'flex-end' }}><View style={{ width: 120, height: 60, overflow:'hidden' }}><OrbMark size={120} /></View></Pressable></Animated.View> : <Animated.View exiting={reducedMotion ? undefined : FadeOutDown.duration(220)} style={{ alignItems: 'center' }}><ParticleOrb status={state.status === 'speaking' ? 'speaking' : state.status === 'connecting' || state.status === 'thinking' ? 'loading' : state.status === 'error' || state.status === 'unavailable' ? 'unavailable' : 'idle'} label="Open voice agent" onPress={() => setOpen(true)} onCollapse={collapse} />{label ? <Txt variant="caption" accent accessibilityLiveRegion="polite">{label}</Txt> : null}</Animated.View>}
    <AppSheet visible={open} title="Talk it through" onClose={() => setOpen(false)} footer={active ? <ButtonRow><Button title={state.muted ? 'Unmute microphone' : 'Mute microphone'} variant="secondary" onPress={() => { feedback(); void controller.toggleMuted(); }} disabled={state.status === 'connecting'} /><Button title="End conversation" onPress={() => { feedback(); void controller.end(); }} /></ButtonRow> : <Button title={state.status === 'error' ? 'Try connecting again' : 'Start conversation'} onPress={start} />}>
      <Group gap={space.sm}><Txt variant="title">Your questions.{'\n'}Your pace.</Txt><Txt muted>{billCase ? 'Ask about the amounts, the evidence behind a question, or what to do next.' : 'Ask for an explanation, an example, or how this term applies to your bill.'}</Txt></Group>
      <Group gap={space.sm}><Txt variant="label">{voice.name} · {language.native}</Txt><Txt variant="caption" muted>{billCase ? `${billCase.attachments.length} available documents · ${billCase.evidenceContextId ? 'Document context ready' : 'Confirmed details and original sources'}` : term?.title}. The agent uses this context for a two-way conversation.</Txt></Group>
      {label ? <Txt accent accessibilityLiveRegion="polite">{label}</Txt> : null}
      {state.messages.map((m, i) => <Group key={i} gap={space.xs}><Txt variant="label" accent>{m.role === 'user' ? 'You' : 'Unfold'}</Txt><Txt>{m.text}</Txt></Group>)}
      {state.error ? <Feedback danger text={state.error} /> : <Txt variant="caption" muted>Live voice requires the ElevenLabs agent connection. No microphone is opened and no case information is sent by this prototype.</Txt>}
      <ButtonRow><Button title="Choose voice" variant="secondary" onPress={() => { setOpen(false); void controller.end(); router.navigate('/voices'); }} /><Button title="Hide orb" variant="quiet" onPress={collapse} /></ButtonRow>
    </AppSheet>
  </>;
}
