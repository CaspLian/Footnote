import { isISODate } from './money';

/** Calendar dates stay in local time; converting through UTC changes some dates. */
export function dateFromCalendar(value: string, fallback = new Date()) {
  if (!isISODate(value)) return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 12);
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}
export function calendarFromDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
