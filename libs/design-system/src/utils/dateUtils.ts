import { today, getLocalTimeZone } from '@internationalized/date';
export type { CalendarDate } from '@internationalized/date';

export function getToday() {
  return today(getLocalTimeZone());
}
