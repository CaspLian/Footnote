import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { calendarFromDate } from '@/domain/calendar-date';
export function openAndroidDate(value: Date, label: string, color: string, onChange: (value: string) => void) {
  DateTimePickerAndroid.open({ value, mode: 'date', positiveButton: { label, textColor: color }, onChange: (event, selected) => { if (event.type === 'set' && selected) onChange(calendarFromDate(selected)); } });
}
