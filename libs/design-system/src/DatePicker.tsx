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

interface DatePickerProps {
  label: string;
  value: string; // Format: YYYY-MM-DD
  onChange: (value: string) => void;
}

export function DatePicker({ label, value, onChange }: DatePickerProps) {
  // Convert string to CalendarDate for react-aria
  const calendarValue = value ? parseDate(value) : null;
  
  const handleChange = (date: CalendarDate | null) => {
    if (date) {
      // Convert CalendarDate back to YYYY-MM-DD string
      onChange(date.toString());
    } else {
      onChange('');
    }
  };
  
  return (
    <AriaDatePicker
      value={calendarValue}
      onChange={handleChange}
      className="flex flex-col gap-1"
    >
      <Label className="block text-sm font-medium text-gray-700">{label}</Label>
      <Group className="flex relative">
        <DateInput className="flex-1 flex px-3 py-2 border border-gray-300 rounded-lg focus-within:outline-none focus-within:ring-2 focus-within:ring-sky-600 focus-within:border-transparent">
          {(segment) => (
            <DateSegment
              segment={segment}
              className="px-0.5 tabular-nums outline-none rounded-sm focus:bg-sky-600 focus:text-white caret-transparent placeholder-shown:italic"
            />
          )}
        </DateInput>
        <Button 
          className="ml-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 pressed:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
          aria-label="Open calendar"
        >
          📅
        </Button>
      </Group>
      <Popover className="bg-white border border-gray-300 rounded-lg shadow-lg">
        <Dialog className="p-4 outline-none">
          <Calendar>
            <header className="flex items-center gap-2 mb-4">
              <Button
                slot="previous"
                className="px-2 py-1 hover:bg-gray-100 rounded"
              >
                ◀
              </Button>
              <Heading className="flex-1 text-center font-semibold" />
              <Button
                slot="next"
                className="px-2 py-1 hover:bg-gray-100 rounded"
              >
                ▶
              </Button>
            </header>
            <CalendarGrid className="border-spacing-1 border-separate">
              <CalendarGridHeader>
                {(day) => (
                  <CalendarHeaderCell className="text-xs font-semibold text-gray-600">
                    {day}
                  </CalendarHeaderCell>
                )}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => (
                  <CalendarCell
                    date={date}
                    className="w-9 h-9 text-sm cursor-pointer rounded hover:bg-gray-100 selected:bg-sky-600 selected:text-white disabled:text-gray-300 outside-month:text-gray-400"
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
