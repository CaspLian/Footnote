import { useTranslation } from '@/localization/use-translation';
import { ReactNode, useState } from 'react';
import { Platform } from 'react-native';
import { openAndroidDate } from './android-date-picker';
import { dateFromCalendar, calendarFromDate } from '@/domain/calendar-date';
import { formatDate, isISODate } from '@/domain';
import { space, useTheme } from '@/theme';
import { Button, Feedback, Group, Txt } from './ui';
import { AppSheet } from './sheet';
import { CalendarPicker } from './calendar-picker';

export interface DateFieldProps { label: string; value: string; onChange: (value: string) => void; confirmLabel?: string; sheetTitle?: string; help?: string; error?: string; trigger?: (open: () => void) => ReactNode; }
export function DateField({ label, value, onChange, confirmLabel = 'Use this date', sheetTitle = label, help, error, trigger }: DateFieldProps) {
  const { colors } = useTheme();
  const { formatLocale } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(() => calendarFromDate(dateFromCalendar(value)));
  function choose() {
    const date = dateFromCalendar(value);
    if (Platform.OS === 'android') {
      openAndroidDate(date, confirmLabel, colors.accent, onChange);
    } else { setPending(calendarFromDate(date)); setOpen(true); }
  }
  return <Group gap={space.md}>
    {trigger ? trigger(choose) : <><Txt variant="label">{label}</Txt><Button title={value ? formatDate(value, formatLocale) : 'Choose a date'} icon="calendar" variant="secondary" onPress={choose} /></>}
    {error ? <Feedback danger text={error} /> : null}
    <AppSheet title={sheetTitle} visible={open} onClose={() => setOpen(false)} footer={<Group gap={space.md}>
      <Group gap={space.xs}><Txt variant="caption" muted>Selected date</Txt><Txt variant="item" accessibilityLiveRegion="polite">{isISODate(pending) ? formatDate(pending, formatLocale) : 'Choose a date'}</Txt></Group>
      <Button title={confirmLabel} disabled={!isISODate(pending)} onPress={() => { if (isISODate(pending)) { onChange(pending); setOpen(false); } }} />
    </Group>}>
      <CalendarPicker label={label} value={pending} onChange={setPending} />
      {help ? <Txt muted>{help}</Txt> : null}
    </AppSheet>
  </Group>;
}
