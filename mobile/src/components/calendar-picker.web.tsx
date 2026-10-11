import { createElement } from 'react';
import { fonts, radius, useTheme } from '@/theme';
import { useTranslation } from '@/localization/use-translation';
import type { CalendarPickerProps } from './calendar-picker';
export function CalendarPicker({ label, value, onChange }: CalendarPickerProps) {
  const { colors, scheme } = useTheme(); const { t, formatLocale } = useTranslation();
  return createElement('input', {
    type: 'date', value, lang: formatLocale, 'aria-label': t(label),
    onInput: (event: { currentTarget: { value: string } }) => onChange(event.currentTarget.value),
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    style: { colorScheme: scheme, fontFamily: fonts.regular, fontSize: 18, minHeight: 56, padding: '12px 16px', borderRadius: radius.control, background: colors.surface, color: colors.ink, border: `1px solid ${colors.line}`, boxSizing: 'border-box', width: '100%' },
  });
}
