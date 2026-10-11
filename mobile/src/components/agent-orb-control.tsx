import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Platform, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { AgentController, agentLanguage, voiceAgentService, type AgentContext } from '@/services/voice-agent';
import { privacyNoticeStore } from '@/services/elevenlabs-conversation';
import { backendConfigured, backendLocale } from '@/services/backend';
import { PushToTalk } from '@/native/push-to-talk';
import type { BillCase } from '@/domain';
import { useFootnoteStore } from '@/store';
import { useVoiceCatalog } from './use-voice-catalog';
import { resolveVoiceKey } from '@/services/voice-catalog';
import { useTheme, space } from '@/theme';
import { Button, Feedback, Field, Group, Txt } from './ui';
import { SettingsToggle } from './settings-controls';
import { Icon } from './icon';
import { AppSheet } from './sheet';
import { ParticleOrb } from './particle-orb';

export function AgentOrbControl({ billCase, term, collapsed, onCollapsedChange }: { billCase?: BillCase; term?: AgentContext['term']; collapsed: boolean; onCollapsedChange: (collapsed: boolean) => void }) {
  const { colors, reducedMotion } = useTheme();
  const prefs = useFootnoteStore(s => s.preferences); const personalContext = useFootnoteStore(s => s.personalContext); const profiles = useFootnoteStore(s => s.profiles);
  const controller = useMemo(() => new AgentController(voiceAgentService), []);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const privacyNotice = useSyncExternalStore(privacyNoticeStore.subscribe, privacyNoticeStore.get, privacyNoticeStore.get);
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [question, setQuestion] = useState('');
  const [showPrivacy, setShowPrivacy] = useState(false);
  const catalog = useVoiceCatalog();
  const priorStatus = useRef(state.status), priorInterruptions = useRef(state.interruptions);
  const collapseProgress = useSharedValue(0);
  const voiceLevel = useSharedValue(0);
  const captionScroll = useRef<ScrollView>(null);
  const [captionHeight, setCaptionHeight] = useState(22);
  const [captionWidth, setCaptionWidth] = useState(266);
  // Follow the orb during a manual pull. Its bottom-anchored container takes over on release.
  const captionMotion = useAnimatedStyle(() => ({ transform: [{ translateY: collapsed ? 0 : collapseProgress.get() }] }));
  const active = ['connecting', 'listening', 'thinking', 'speaking'].includes(state.status);
  const voice = { id: prefs.voice, name: catalog?.voices.find(v => v.key === resolveVoiceKey(prefs.voice, backendLocale(prefs.workingLanguage), catalog))?.name ?? 'Agent voice' };
  useEffect(() => {
    if (state.status === 'speaking' && priorStatus.current !== 'speaking' && Platform.OS !== 'web' && prefs.haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    priorStatus.current = state.status;
  }, [state.status, prefs.haptics]);
  useEffect(() => {
    if (state.interruptions > priorInterruptions.current && Platform.OS !== 'web' && prefs.haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    priorInterruptions.current = state.interruptions;
  }, [state.interruptions, prefs.haptics]);
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
  function start(withFeedback = true) {
    if (withFeedback) feedback();
    setOpen(false);
    const profile = profiles.find(p => p.id === billCase?.profileId);
    void controller.start({ language: prefs.workingLanguage, agentLanguage: agentLanguage(prefs.workingLanguage), voice: voice.id, case: billCase ? { id: billCase.id, evidenceContextId: billCase.evidenceContextId, entriesEdited: billCase.entriesEdited, provider: billCase.provider, serviceDate: billCase.serviceDate, financials: billCase.financials, findings: billCase.findings, reviewMode: billCase.reviewMode } : undefined, evidence: billCase?.attachments.map(a => ({ id: a.id, kind: a.kind, name: a.name })) ?? [], profile: profile ? { firstName: profile.firstName, coverage: profile.coverage, insurer: profile.insurer, planName: profile.planName, zipCode: profile.zipCode } : undefined, preferences: personalContext, term });
  }
  // Keep the agent's last words on screen between caption updates; clear them once it stops or starts thinking.
  const [lastAgentCaption, setLastAgentCaption] = useState('');
  const keptCaption = state.caption?.text || (!active || state.status === 'idle' || state.status === 'thinking' ? '' : lastAgentCaption);
  if (keptCaption !== lastAgentCaption) setLastAgentCaption(keptCaption);
  const currentCaption = active ? keptCaption : '';
  const label = state.status === 'speaking' ? 'Speaking' : state.status === 'listening' ? state.muted ? 'Microphone muted' : 'Listening' : state.status === 'thinking' ? 'Thinking' : state.status === 'connecting' ? 'Connecting…' : '';
  return <>
    <View pointerEvents="box-none" style={{ alignItems: 'center', maxWidth: 320, width: '100%', gap: 0 }}>
      {active && currentCaption ? <Txt translate={false} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" onTextLayout={event => setCaptionWidth(Math.min(266, Math.ceil(Math.max(1, ...event.nativeEvent.lines.map(line => line.width))) + 1))} style={{ position: 'absolute', opacity: 0, width: 266, fontSize: collapsed ? 13 : 15, lineHeight: collapsed ? 19 : 22 }}>{currentCaption}</Txt> : null}
      {prefs.voiceCaptions && (label || state.error || currentCaption) ? <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(180)}><Animated.View style={[{ alignSelf: 'center', maxWidth: 290, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, boxShadow: '0 3px 12px rgba(0,0,0,0.08)' }, captionMotion]}>
        {active && currentCaption ? <ScrollView ref={captionScroll} nestedScrollEnabled style={{ width: captionWidth, height: Math.min(captionHeight, collapsed ? 120 : 180), flexGrow: 0 }} onContentSizeChange={(_width, height) => { setCaptionHeight(height); captionScroll.current?.scrollToEnd({ animated: !reducedMotion }); }}><Txt translate={false} accessibilityLabel={`Footnote: ${currentCaption}`} accessibilityLiveRegion={state.caption?.final ? 'polite' : 'none'} style={{ fontSize: collapsed ? 13 : 15, lineHeight: collapsed ? 19 : 22, textAlign: 'center' }}>{currentCaption}</Txt></ScrollView> : <Txt variant="caption" accent accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>{label || 'Voice unavailable. Hold for controls.'}</Txt>}
      </Animated.View></Animated.View> : null}
      <ParticleOrb status={state.status === 'speaking' ? 'speaking' : state.status === 'listening' && !state.muted ? 'listening' : state.status === 'connecting' || state.status === 'thinking' ? 'loading' : state.status === 'error' || state.status === 'unavailable' ? 'unavailable' : 'idle'} onDoublePress={() => { if (Platform.OS !== 'web' && prefs.haptics) { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); } setOpen(false); void controller.end(); }} label={active ? state.muted ? 'Unmute voice agent' : `Mute voice agent. ${label}` : 'Start voice conversation'} onPress={() => { if (!active) start(false); else if (state.status !== 'connecting') void controller.toggleMuted(); }} onLongPress={() => setOpen(true)} onCollapse={collapse} onExpand={expand} collapsed={collapsed} collapseProgress={collapseProgress} level={voiceLevel}/>
    </View>
    <AppSheet visible={open} title="Talk it through" onClose={() => setOpen(false)} footer={active ? <Button title="End conversation" icon="stop" onPress={() => { feedback(); void controller.end(); }} /> : <Button title={state.status === 'error' ? 'Try connecting again' : 'Start conversation'} icon="microphone" onPress={() => start()} />}>
      <Group gap={space.xs}><Txt translate={false} variant="heading">{voice.name}</Txt>{label ? <Txt accent accessibilityLiveRegion="polite">{label}</Txt> : null}</Group>
      <Group gap={space.md}>
        {active ? <Button title={state.muted ? 'Unmute microphone' : 'Mute microphone'} icon={state.muted ? 'microphoneOff' : 'microphone'} variant="secondary" onPress={() => { feedback(); void controller.toggleMuted(); }} disabled={state.status === 'connecting'} /> : null}
        <View style={{flexDirection:'row',alignItems:'center',paddingLeft:space.lg,borderRadius:16,backgroundColor:colors.surface}}><Icon name="captions" size={22} color={colors.accent}/><View style={{flex:1}}><SettingsToggle title="Captions" value={prefs.voiceCaptions} onChange={value => { feedback(); useFootnoteStore.getState().setPreferences({voiceCaptions:value}); }} /></View></View>
        <Button title="Choose voice" icon="speaker" variant="secondary" onPress={() => { setOpen(false); void controller.end(); router.navigate('/voices'); }} />
        {active ? <Button title={typing ? 'Hide keyboard' : 'Type a question'} icon="edit" variant="secondary" disabled={state.status === 'connecting'} onPress={() => setTyping(value=>!value)} /> : null}
        {typing && active ? <Group gap={space.md}><Field label="Your question" value={question} onChangeText={text => { setQuestion(text); controller.userActivity(); }} placeholder="Ask about this bill" multiline maxLength={1000} autoFocus /><Button title="Send question" icon="next" disabled={!question.trim() || state.status==='connecting'} onPress={() => { if(controller.sendText(question)) { setQuestion(''); setTyping(false); setOpen(false); } }} /></Group> : null}
        <Button title="Minimize orb" icon="minimize" variant="secondary" onPress={collapse} />
      </Group>
      {state.error ? <Feedback danger text={state.error} /> : !backendConfigured() ? <Txt variant="caption" muted>Live voice is unavailable while the app is offline. Connect the backend to talk through a saved bill.</Txt> : null}
      {backendConfigured() && (state.status === 'error' || state.status === 'unavailable') ? <PushToTalk key={`${prefs.workingLanguage}-${voice.id}`} language={prefs.workingLanguage} voice={voice.id} /> : null}
      {backendConfigured() ? <Group gap={space.sm}><Button compact title={showPrivacy ? 'Hide data use' : 'Data use'} icon="lock" variant="link" onPress={()=>setShowPrivacy(value=>!value)}/>{showPrivacy?<Txt variant="caption" muted>{privacyNotice}</Txt>:null}</Group> : null}
    </AppSheet>
  </>;
}
