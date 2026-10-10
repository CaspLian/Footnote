// Phosphor passes className for its optional web styling API. Native SVG ignores it.
import 'react-native-svg';
declare module 'react-native-svg' { interface SvgProps { className?: string } }
