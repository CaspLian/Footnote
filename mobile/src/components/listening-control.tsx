import { View } from 'react-native';
import type { NarrationStatus } from '@/native/narration-controller';
import { ParticleOrb } from './particle-orb';
import { Txt } from './ui';
/** A free-standing overlay; the primary action stays in its own full-width footer. */
export function ListeningControl({ status, onPress }: { status: NarrationStatus; onPress: () => void }) {
  const active = status === 'speaking' || status === 'loading';
  const retry = status === 'error' || status === 'unavailable';
  return <View pointerEvents="box-none" style={{ alignItems: 'center' }}>
    <ParticleOrb status={status} onPress={onPress} label={active ? 'Stop explanation' : retry ? 'Retry explanation' : 'Listen to the explanation'} />
    {active || retry ? <Txt variant="caption" accent accessibilityLiveRegion="polite">{status === 'speaking' ? 'Speaking' : status === 'loading' ? 'Getting the voice ready…' : 'Voice unavailable · Retry'}</Txt> : null}
  </View>;
}
