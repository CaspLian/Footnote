import { router } from 'expo-router';
import { Button, Card, Divider, Group, Hero, Row, Screen, Txt, useDesktop } from '@/components/ui';
import { Icon } from '@/components/icon';
import { useTheme, space } from '@/theme';
import { useUnfoldStore } from '@/store';
export function Welcome(){ const { colors } = useTheme();const desktop=useDesktop();function start(demo=false){useUnfoldStore.getState().completeWelcome();router.push({pathname:'/onboarding',params:{demo:demo?'1':'0'}});}
const specimen=<Hero><Icon name="document" feature size={40} color={colors.accent}/><Txt variant="section">One bill. A clearer picture.</Txt><Card><Row label="Statement" value="$494.00"/><Divider/><Row label="EOB responsibility" value="$294.00"/></Card><Txt variant="caption" muted>A synthetic example. Never a savings promise.</Txt></Hero>;
return <Screen testID="welcome" aside={desktop?specimen:undefined} footer={<Button title="Make it yours" icon="next" onPress={()=>start()}/>}>
{!desktop?specimen:null}<Group gap={space.lg}><Txt variant="display">Understand the bill.{'\n'}Own the next step.</Txt><Txt muted>Bring your documents together, follow the evidence and prepare a request you can send yourself.</Txt></Group><Button title="See how it works" variant="quiet" icon="next" onPress={()=>start(true)}/><Txt variant="caption" muted>No account. Your profiles and bills stay here.</Txt></Screen>;
}
