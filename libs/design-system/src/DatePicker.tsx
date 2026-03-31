import {
  DatePicker as AriaDatePicker,
  Label,
  Group,
  DateInput,
  DateSegment,
  Button,
  Calendar,
  CalendarGrid,
  CalendarGridHeader,
  CalendarGridBody,
  CalendarHeaderCell,
  CalendarCell,
  Heading,
  Dialog,
  Popover,
} from 'react-aria-components';
import { parseDate, CalendarDate } from '@internationalized/date';
import { useTranslation } from 'react-i18next';
import { getToday } from './utils/dateUtils';

interface DatePickerProps {
  label: string;
  value: string; // Format: YYYY-MM-DD
  onChange: (value: string) => void;
}

export function DatePicker({ label, value, onChange }: DatePickerProps) {
  const { t } = useTranslation();
  const calendarValue = value ? parseDate(value) : null;
  const todayDate = getToday();

  const handleChange = (date: CalendarDate | null) => {
    if (date) {
      onChange(date.toString());
    } else {
      onChange('');
    }
  };

  return (
    <AriaDatePicker
      value={calendarValue}
      onChange={handleChange}
      className="flex flex-col gap-1.5"
    >
      <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</Label>
      <Group className="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-shadow">
        <DateInput className="flex-1 flex px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none bg-transparent">
          {(segment) => (
            <DateSegment
              segment={segment}
              className="px-0.5 tabular-nums outline-none rounded focus:bg-blue-500 focus:text-white caret-transparent placeholder-shown:italic placeholder-shown:text-gray-400 dark:placeholder-shown:text-gray-500"
            />
          )}
        </DateInput>
        <Button
          className="cursor-pointer px-3 py-2 border-l border-gray-200 dark:border-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-r-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={t('datepicker.openCalendar', 'Open calendar')}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
            />
          </svg>
        </Button>
      </Group>
      <Popover className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-600 mt-1">
        <Dialog className="p-4 outline-none">
          <Calendar>
            <header className="flex items-center justify-between mb-3">
              <Button
                slot="previous"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 19.5 8.25 12l7.5-7.5"
                  />
                </svg>
              </Button>
              <Heading className="text-sm font-medium text-gray-900 dark:text-gray-100" />
              <Button
                slot="next"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m8.25 4.5 7.5 7.5-7.5 7.5"
                  />
                </svg>
              </Button>
            </header>
            <CalendarGrid className="border-spacing-1 border-separate">
              <CalendarGridHeader>
                {(day) => (
                  <CalendarHeaderCell className="w-9 h-8 text-xs font-medium text-gray-400 dark:text-gray-500">
                    {day}
                  </CalendarHeaderCell>
                )}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => (
                  <CalendarCell
                    date={date}
                    className={`w-9 h-9 flex items-center justify-center text-sm cursor-pointer rounded-full outline-none transition-colors
                      text-gray-900 dark:text-gray-100
                      hover:bg-gray-100 dark:hover:bg-gray-700
                      selected:bg-blue-500 selected:text-white selected:hover:bg-blue-600
                      disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-default
                      outside-month:text-gray-300 dark:outside-month:text-gray-600
                      focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1
                      ${!calendarValue && date.compare(todayDate) === 0 ? 'font-bold text-blue-500' : ''}
                    `}
                  />
                )}
              </CalendarGridBody>
            </CalendarGrid>
          </Calendar>
        </Dialog>
      </Popover>
    </AriaDatePicker>
  );
}
