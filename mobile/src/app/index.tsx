import { Redirect } from 'expo-router';
import { useFootnoteStore } from '@/store';
export default function Index() { const completed=useFootnoteStore(s=>s.welcomeCompleted);const onboarding=useFootnoteStore(s=>s.onboardingCompleted);return <Redirect href={!completed?'/welcome':!onboarding?'/onboarding':'/(tabs)/(home)'} />; }
