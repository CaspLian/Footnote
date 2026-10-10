import DateTimePicker from '@react-native-community/datetimepicker';
import { calendarFromDate, dateFromCalendar } from '@/domain/calendar-date';
import { useTheme } from '@/theme';
export interface CalendarPickerProps { label: string; value: string; onChange: (value: string) => void; }
export function CalendarPicker({ label, value, onChange }: CalendarPickerProps) {
  const { colors, scheme } = useTheme();
  return <DateTimePicker accessibilityLabel={label} value={dateFromCalendar(value)} mode="date" display="inline" themeVariant={scheme} accentColor={colors.accent} onChange={(_event, selected) => { if (selected) onChange(calendarFromDate(selected)); }} style={{ alignSelf: 'stretch' }} />;
}
