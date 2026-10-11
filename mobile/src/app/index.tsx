import { Redirect } from 'expo-router';
import { useUnfoldStore } from '@/store';
export default function Index() { const completed=useUnfoldStore(s=>s.welcomeCompleted);const onboarding=useUnfoldStore(s=>s.onboardingCompleted);return <Redirect href={!completed?'/welcome':!onboarding?'/onboarding':'/(tabs)/(home)'} />; }
