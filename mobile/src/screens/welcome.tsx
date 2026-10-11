import { router } from 'expo-router';
import { Button, Group, Hero, Screen, Txt, useDesktop } from '@/components/ui';
import { FootnoteMark } from '@/components/footnote-mark';
import { space } from '@/theme';
import { useFootnoteStore } from '@/store';

export function Welcome() {
  const desktop = useDesktop();
  function start() { useFootnoteStore.getState().completeWelcome(); router.push('/onboarding'); }
  const introduction = <Hero>
    <FootnoteMark size={64} />
    <Txt variant="title">Footnote</Txt>
    <Txt variant="section">One bill. A clearer picture.</Txt>
    <Txt muted>Bring together your bill and explanation of benefits. Understand the charges, check the details, and prepare your questions.</Txt>
  </Hero>;
  return <Screen testID="welcome" aside={desktop ? introduction : undefined} footer={<Button title="Make it yours" icon="next" onPress={start} />}>
    {!desktop ? introduction : null}
    <Group gap={space.lg}><Txt variant="display">Understand the bill.{'\n'}Own the next step.</Txt><Txt muted>Bring your documents together, follow the evidence and prepare a request you can send yourself.</Txt></Group>
    <Txt variant="caption" muted>Your profiles and original documents stay on this device. Document analysis and voice conversations use the connected services.</Txt>
  </Screen>;
}
