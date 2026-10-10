import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarFromDate, dateFromCalendar } from './calendar-date';

test('calendar date round trips through a local Date without UTC conversion', () => {
  for (const value of ['2026-10-10', '2026-03-08', '2026-11-01', '2028-02-29']) {
    assert.equal(calendarFromDate(dateFromCalendar(value)), value);
    assert.equal(dateFromCalendar(value).getHours(), 12);
  }
});
test('empty or invalid calendar values use a local fallback without saving it', () => {
  const fallback = new Date(2026, 9, 10, 23);
  for (const value of ['', '2026-02-30', 'invalid']) assert.equal(calendarFromDate(dateFromCalendar(value, fallback)), '2026-10-10');
});
