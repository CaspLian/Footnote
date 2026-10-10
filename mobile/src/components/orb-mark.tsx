import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { orbParticles, orbPaths } from '@/domain/orb-particles';
import { useTheme } from '@/theme';
const paths = orbPaths(orbParticles(128), .5, 0, 0, .32);
/** Static marks for settings and the collapsed handle never run an animation loop. */
export function OrbMark({ size = 28, shadow = false, active = false }: { size?: number; shadow?: boolean; active?: boolean }) {
  const { colors, scheme } = useTheme(); const ink = scheme === 'dark' ? '#050F0C' : colors.ink;
  return <Svg aria-hidden={true} pointerEvents="none" width={size} height={size} viewBox="0 0 56 56" style={{ flexShrink: 0 }}>{shadow ? <><Defs>
    <RadialGradient id="miniSoftening"><Stop offset="0" stopColor={colors.background} /><Stop offset={.55} stopColor={colors.background} /><Stop offset="1" stopColor={colors.background} stopOpacity={0} /></RadialGradient>
    <RadialGradient id="miniShadow"><Stop offset="0" stopColor={ink} stopOpacity={scheme === 'dark' ? .8 : .24} /><Stop offset={.65} stopColor={ink} stopOpacity={scheme === 'dark' ? .3 : .1} /><Stop offset="1" stopColor={ink} stopOpacity={0} /></RadialGradient>
  </Defs><Circle cx={28} cy={28} r={28} fill="url(#miniSoftening)" /><Circle cx={28} cy={30} r={28} fill="url(#miniShadow)" /></> : null}{paths.map((d, i) => <Path key={i} d={d} fill={active ? colors.accent : colors.ink} opacity={[.35, .65, 1][i]} />)}</Svg>;
}
