import Svg, { Rect } from 'react-native-svg';
import { useTheme } from '@/theme';

/** The supplied five-arm printers' asterisk, drawn in the current theme color. */
export function FootnoteMark({ size = 32 }: { size?: number }) {
  const { colors } = useTheme();
  return <Svg width={size} height={size} viewBox="0 0 100 100" accessible={false}>
    {[0, 72, 144, 216, 288].map(angle => <Rect key={angle} x={43} y={10} width={14} height={27} rx={7} fill={colors.accent} transform={`rotate(${angle} 50 50)`} />)}
  </Svg>;
}
