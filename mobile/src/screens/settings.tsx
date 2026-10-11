import { OrbMark } from '@/components/orb-mark';
import { LanguageFlag } from '@/components/language-picker';
import { languageOption } from '@/domain/languages';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { useFootnoteStore } from '@/store';
import { clearLocalAttachments, nativeErrorMessage } from '@/native';
import { voiceChoices } from '@/domain/preferences';
import { Feedback, Group, Screen, Txt } from '@/components/ui';
import { usePrivacy } from '@/components/privacy';
import { confirmAction } from '@/components/confirm';
import { SettingsDivider, SettingsGroup, SettingsLink, SettingsPicker, SettingsToggle } from '@/components/settings-controls';
import { openProfiles } from '@/components/navigation';
import { space } from '@/theme';
import { backendConfigured, backendHealth, backendLocale } from '@/services/backend';
import { resolveVoiceKey } from '@/services/voice-catalog';
import { useVoiceCatalog } from '@/components/use-voice-catalog';

export function Settings() {
  const privacy = usePrivacy();
  const prefs = useFootnoteStore(s => s.preferences);
  const catalog = useVoiceCatalog();
  const resolved = catalog?.voices.find(v => v.key === resolveVoiceKey(prefs.voice, backendLocale(prefs.workingLanguage), catalog));
  const [connection, setConnection] = useState('Checking connection…');
  const [healthRevision, setHealthRevision] = useState(0);
  useEffect(() => {
    if (!backendConfigured()) return;
    const abort = new AbortController();
    void backendHealth(abort.signal).then(result => { if (!abort.signal.aborted) setConnection(result.mock ? 'Connected · Document reading unavailable' : 'Connected to Footnote'); }).catch(() => { if (!abort.signal.aborted) setConnection('Could not reach Footnote. Check the connection and try again.'); });
    return () => abort.abort();
  }, [healthRevision]);
  const context = useFootnoteStore(s => s.personalContext);
  const cases = useFootnoteStore(s => s.cases);
  const profiles = useFootnoteStore(s => s.profiles);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = useFootnoteStore.getState().setPreferences;
  const voice = voiceChoices.find(v => v.id === (prefs.voice === 'device' ? 'calm' : prefs.voice))!;
  const language = languageOption(prefs.workingLanguage);
  function clearImports() {
    confirmAction('Delete imported cases?', 'This removes imported documents, drafts and their history from this device. Your family profiles are kept.', 'Delete imports', () => {
      setBusy(true); setError('');
      void (async () => { try { for (const c of cases.filter(c => c.source === 'manual')) await useFootnoteStore.getState().deleteCase(c.id); await clearLocalAttachments(); } catch (e) { setError(nativeErrorMessage(e, 'en')); } finally { setBusy(false); } })();
    }, true);
  }
  return <Screen contentWidth={720} testID="settings">
    <Group gap={space.lg}><Txt variant="display">Make it feel{'\n'}like yours.</Txt><Txt muted>Useful preferences, saved on this device.</Txt></Group>
    <SettingsGroup title="Your household">
      <SettingsLink title="Family profiles" detail={`${profiles.length} ${profiles.length === 1 ? 'profile' : 'profiles'} saved locally`} icon="family" onPress={openProfiles} />
      <SettingsDivider /><SettingsLink title="Personal context" detail="Your insurance, region and review goals" icon="profile" onPress={() => router.navigate('/onboarding')} />
    </SettingsGroup>
    <SettingsGroup title="Language"><SettingsLink title="Working language" detail={language.native} leading={<LanguageFlag country={language.country} size="compact" />} onPress={() => router.navigate('/languages')} /></SettingsGroup>
    <SettingsGroup title="Appearance">
      <SettingsPicker title="App theme" value={prefs.theme} options={[{ label: 'System', value: 'system' }, { label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }]} onChange={theme => set({ theme })} />
    </SettingsGroup>
    <SettingsGroup title="Voice & explanations" note="Live conversations use a saved bill’s analysis. Choose a language and voice for your questions.">
      <SettingsLink title="Agent voice" detail={`${voice.name} · ${backendConfigured() ? resolved?.name ?? 'ElevenLabs' : 'Voice unavailable'}`} leading={<OrbMark/>} onPress={() => router.navigate('/voices')} />
      <SettingsDivider /><SettingsPicker title="Explanation detail" value={context.explanationDepth} options={[{ label: 'Simple', value: 'simple' }, { label: 'Detailed', value: 'detailed' }]} onChange={useFootnoteStore.getState().setExplanationDepth} />
    </SettingsGroup>
    <SettingsGroup title="Interaction" note="System accessibility preferences are always respected.">
      <SettingsToggle title="Haptic feedback" detail={Platform.OS === 'web' ? 'Used in the mobile app.' : 'Gentle feedback for main actions.'} value={prefs.haptics} onChange={haptics => set({ haptics })} />
      <SettingsDivider /><SettingsToggle title="Reduce motion" detail="Simpler transitions and a still loading indicator." value={prefs.reduceMotion} onChange={reduceMotion => set({ reduceMotion })} />
    </SettingsGroup>
    <SettingsGroup title="Bills">
      <SettingsPicker title="Sort bills by" value={prefs.billSort} options={[{ label: 'Most recent', value: 'recent' }, { label: 'Highest balance', value: 'balance' }, { label: 'Next follow-up', value: 'follow_up' }]} onChange={billSort => set({ billSort })} />
      <SettingsDivider /><SettingsToggle title="Show resolved bills" value={prefs.showResolved} onChange={showResolved => set({ showResolved })} />
    </SettingsGroup>
    <SettingsGroup title="Privacy" note="App lock controls access; it does not encrypt imported files.">
      {Platform.OS === 'web' ? <Group style={{ padding: space.lg }}><Txt variant="label">Biometric app lock</Txt><Txt muted>Available with Face ID or fingerprint authentication in the mobile app.</Txt></Group> : <>
        <SettingsToggle title={`${privacy.label} app lock`} detail="Authenticate after reopening Footnote. Device passcode can be used as a fallback." value={privacy.enabled} disabled={privacy.busy} onChange={() => { void privacy.toggle(); }} />
        {privacy.enabled ? <><SettingsDivider /><SettingsLink title="Lock workspace now" icon="lock" onPress={privacy.lock} /></> : null}
      </>}
    </SettingsGroup>
    {privacy.message ? <Feedback text={privacy.message} /> : null}
    <SettingsGroup title="Local data" note="Deleting a case removes its documents, drafts and recorded actions from this device.">
      <SettingsLink title="Delete imported cases" detail={`${cases.filter(c => c.source === 'manual').length} imported ${cases.filter(c => c.source === 'manual').length === 1 ? 'case' : 'cases'}`} icon="files" danger onPress={clearImports} disabled={busy || !cases.some(c => c.source === 'manual')} />
    </SettingsGroup>
    {error ? <Feedback danger onDismiss={() => setError('')} text={error} /> : null}
    {backendConfigured() ? <SettingsGroup title="Backend connection"><SettingsLink title={connection} detail="Tap to check again" icon="document" onPress={() => { setConnection('Checking connection…'); setHealthRevision(v => v + 1); }} /></SettingsGroup> : null}
    <Group gap={space.sm}><Txt variant="label">Footnote · 0.1</Txt><Txt variant="caption" muted>{backendConfigured() ? 'Bills you analyze are sent to your Footnote backend (Gemini, Medicare rates, Tiger Data, ElevenLabs).' : 'No account. No family cloud. Sponsor services are not connected.'}</Txt></Group>
  </Screen>;
}
