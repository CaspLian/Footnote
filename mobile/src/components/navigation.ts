import { router } from 'expo-router';
/** navigate unwinds to an existing route instead of pushing another copy. */
export function openSettings() { router.navigate('/settings'); }
export function openProfiles() { router.navigate('/profiles'); }
