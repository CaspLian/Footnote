import { useState } from 'react';
import { Keyboard, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { FamilyProfile, PersonalContext, Coverage } from '@/domain';
import { type WorkingLanguage } from '@/domain/languages';
import { useFootnoteStore } from '@/store';
import { Button, Choice, Feedback, Field, Group, Screen, Txt } from '@/components/ui';
import { LanguageGrid } from '@/components/language-picker';
import { useMotionPreference, useTheme, motion, space } from '@/theme';

const coverageOptions: [Coverage, string][] = [['private', 'Employer / private insurance'], ['medicare', 'Medicare'], ['medicaid', 'Medicaid'], ['uninsured', 'No insurance / self-pay'], ['unsure', 'I’m not sure yet']];

export function Onboarding() {
  const { colors } = useTheme();
  const existing = useFootnoteStore(s => s.profiles.find(p => p.relationship === 'self'));
  const prefs = useFootnoteStore(s => s.personalContext);
  const savedLanguage = useFootnoteStore(s => s.preferences.workingLanguage);
  const completed = useFootnoteStore(s => s.onboardingCompleted);
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState<WorkingLanguage | undefined>(completed ? savedLanguage : undefined);
  const [profile, setProfile] = useState<Omit<FamilyProfile, 'id'>>(existing ?? { firstName: '', relationship: 'self', zipCode: '', coverage: 'unsure', insurer: '', planName: '' });
  const [context, setContext] = useState<PersonalContext>(prefs);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const reduced = useMotionPreference();
  const nameValid = !!profile.firstName.trim() && profile.firstName.trim().length <= 80;
  const canContinue = !!language && (step === 0 || nameValid);
  const patch = (value: Partial<typeof profile>) => { setError(''); setProfile(p => ({ ...p, ...value })); };

  async function next() {
    if (busy) return;
    setError('');
    if (!language) { setError('Choose a working language before continuing.'); return; }
    if (step > 0 && !nameValid) { setError('Enter a first name or nickname, up to 80 characters.'); return; }
    if (step === 1 && profile.zipCode && !/^\d{5}$/.test(profile.zipCode)) { setError('Use a five-digit ZIP code, or leave it blank.'); return; }
    Keyboard.dismiss();
    if (step < 3) { setStep(v => v + 1); return; }
    setBusy(true);
    try {
      useFootnoteStore.getState().setPreferences({ workingLanguage: language });
      useFootnoteStore.getState().completeOnboarding(profile, context);
      await useFootnoteStore.getState().flushPersistence();
      if (useFootnoteStore.getState().storageError) throw Error();
      router.replace('/(tabs)/(home)');
    } catch {
      // The shared storage recovery alert already handles persistence failures.
      if (!useFootnoteStore.getState().storageError) setError('Your setup could not finish. Keep this screen open and try again.');
    } finally { setBusy(false); }
  }

  const footer = <Group gap={space.sm}>
    <Button title={step < 3 ? 'Continue' : 'Finish setup'} disabled={!canContinue} loading={busy} onPress={() => void next()} />
    {step > 0 ? <Button title="Previous step" variant="quiet" disabled={busy} onPress={() => { Keyboard.dismiss(); setError(''); setStep(v => v - 1); }} /> : null}
  </Group>;

  return <Screen testID="onboarding" footer={footer}>
    <Group gap={space.sm}><Txt variant="label" muted>Personal setup · {step + 1} of 4</Txt><View style={{ flexDirection: 'row', gap: space.sm }}>{[0, 1, 2, 3].map(v => <View key={v} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: v <= step ? colors.accent : colors.line }} />)}</View></Group>
    <Animated.View key={step} entering={reduced ? undefined : FadeIn.duration(motion.transition)} exiting={reduced ? undefined : FadeOut.duration(100)} style={{ gap: space.xl }}>
      {step === 0 ? <>
        <Group gap={space.lg}><Txt variant="display">Choose your language</Txt><Txt muted>Select a language for document explanations and conversations.</Txt></Group>
        <LanguageGrid value={language} onChange={value => { setError(''); setLanguage(value); }} />
        <Txt variant="caption" muted>Your choice is saved locally. App screens are in English; the connected agent will use your working language.</Txt>
      </> : step === 1 ? <>
        <Group gap={space.lg}><Txt variant="display">About you</Txt><Txt muted>Your details help organize bills and put future comparisons in context.</Txt></Group>
        <Field label="First name or nickname" accessibilityHint="Required. Enter your first name or a nickname to continue." placeholder="What should we call you?" autoComplete="given-name" value={profile.firstName} onChangeText={v => patch({ firstName: v })} maxLength={80} />
        <Field label="ZIP code · optional" placeholder="Where you usually receive care" keyboardType="number-pad" maxLength={5} value={profile.zipCode} onChangeText={v => patch({ zipCode: v })} />
        <Txt variant="caption" muted>Stored locally. No email, password or account needed.</Txt>
      </> : step === 2 ? <>
        <Group gap={space.lg}><Txt variant="display">Your insurance</Txt><Txt muted>Add what you know. You can fill in the rest later.</Txt></Group>
        <Group gap={space.xs}>{coverageOptions.map(([value, title]) => <Choice key={value} title={title} selected={profile.coverage === value} onPress={() => patch({ coverage: value })} />)}</Group>
        {profile.coverage !== 'uninsured' ? <Group gap={space.lg}><Field label="Insurer · optional" placeholder="Your health plan" value={profile.insurer} onChangeText={v => patch({ insurer: v })} /><Field label="Plan name · optional" placeholder="For your own reference" value={profile.planName} onChangeText={v => patch({ planName: v })} /></Group> : null}
        <Txt variant="caption" muted>We won’t ask for member IDs or Social Security numbers.</Txt>
      </> : <>
        <Group gap={space.lg}><Txt variant="display">Choose your preferences</Txt><Txt muted>Your explanation starts at the level you choose. You can change it on any review.</Txt></Group>
        <Group gap={space.sm}><Choice title="Keep it simple" detail="Plain language and one useful next step." selected={context.explanationDepth === 'simple'} onPress={() => setContext(c => ({ ...c, explanationDepth: 'simple' }))} /><Choice title="Show me the detail" detail="Amounts, comparisons and source documents." selected={context.explanationDepth === 'detailed'} onPress={() => setContext(c => ({ ...c, explanationDepth: 'detailed' }))} /></Group>
        <Group gap={space.sm}><Txt variant="section">Start with</Txt>{([['understand', 'Understanding my bill'], ['check_charges', 'Checking the charges'], ['prepare_request', 'Preparing a request']] as const).map(([goal, title]) => <Choice key={goal} title={title} selected={context.goal === goal} onPress={() => setContext(c => ({ ...c, goal }))} />)}</Group>
      </>}
    </Animated.View>
    {error ? <Feedback danger title="Unable to continue" text={error} onDismiss={() => setError('')} /> : null}
  </Screen>;
}
