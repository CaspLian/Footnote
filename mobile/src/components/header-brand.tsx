import { View, useWindowDimensions } from 'react-native';
import { fonts } from '@/theme';
import { Txt } from './ui';
import { FootnoteMark } from './footnote-mark';
export function HeaderBrand({ section }: { section?: string }) {

  const { width } = useWindowDimensions();
  return <View accessible accessibilityRole="header" accessibilityLabel={section ? `Footnote, ${section}` : 'Footnote'} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: width - 132 }}>

    <FootnoteMark size={28} /><Txt numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -.6 }}>Footnote</Txt>
    {section ? <Txt numberOfLines={1} muted style={{ fontFamily: fonts.regular, fontSize: 22, lineHeight: 28, flexShrink: 1, paddingTop: 4 }}>{section}</Txt> : null}
  </View>;
}
