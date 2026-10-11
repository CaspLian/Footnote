import { View, useWindowDimensions } from 'react-native';
import { fonts } from '@/theme';
import { Txt } from './ui';
export function HeaderBrand({ section }: { section?: string }) {

  const { width } = useWindowDimensions();
  return <View accessible accessibilityRole="header" accessibilityLabel={section ? `Unfold, ${section}` : 'Unfold'} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: width - 132 }}>

    <Txt numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, letterSpacing: -.7 }}>Unfold</Txt>
    {section ? <Txt numberOfLines={1} muted style={{ fontFamily: fonts.regular, fontSize: 22, lineHeight: 28, flexShrink: 1, paddingTop: 4 }}>{section}</Txt> : null}
  </View>;
}
