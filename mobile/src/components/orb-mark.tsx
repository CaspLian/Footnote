import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { orbParticles, orbPaths } from '@/domain/orb-particles';
import { useTheme } from '@/theme';
const paths = orbPaths(orbParticles(128), .5, 0, 0, .32);
/** Static marks for settings and the collapsed handle never run an animation loop. */
export function OrbMark({ size = 28, shadow = false }: { size?: number; shadow?: boolean }) { const { colors } = useTheme(); return <Svg aria-hidden={true} pointerEvents="none" width={size} height={size} viewBox="0 0 56 56">{shadow?<><Defs><RadialGradient id="miniShadow"><Stop offset="0" stopColor={colors.ink} stopOpacity={.2}/><Stop offset=".65" stopColor={colors.ink} stopOpacity={.08}/><Stop offset="1" stopColor={colors.ink} stopOpacity={0}/></RadialGradient></Defs><Circle cx={28} cy={30} r={28} fill="url(#miniShadow)"/></>:null}{paths.map((d, i) => <Path key={i} d={d} fill={colors.accent} opacity={[.35, .65, 1][i]} />)}</Svg>; }
