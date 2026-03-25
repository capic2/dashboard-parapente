import preview from '../.storybook/preview'
import {fn, mocked, screen} from 'storybook/test'
import {DatePicker} from './DatePicker'
import {getToday} from './utils/dateUtils'
import {CalendarDate} from '@internationalized/date'

const MOCK_TODAY = new CalendarDate(2026, 1, 15)

const meta = preview.meta({
  title: 'Components/UI/DatePicker',
  component: DatePicker,
  beforeEach: () => {
    mocked(getToday).mockReturnValue(MOCK_TODAY)
  },
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Date picker component using native HTML5 date input with react-aria Label. Accepts and returns dates in YYYY-MM-DD format.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: 'text',
      description: 'Label text displayed above the date input',
    },
    value: {
      control: 'text',
      description: 'Date value in YYYY-MM-DD format',
    },
    onChange: {
      action: 'date-changed',
      description: 'Callback when date value changes',
    },
  },
})

/*
// Default with a selected date
export const Default = meta.story({
  args: {
    label: 'Flight Date',
    value: '2024-03-15',
    onChange: fn(),
  },
})

// Test date change interaction
Default.test('should render date picker with label', async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  
  // Verify the label is present
  await expect(canvas.getByText('Flight Date')).toBeInTheDocument()
  
  // Verify the calendar button is present
  const calendarButton = canvas.getByRole('button', { name: 'Open calendar' })
  await expect(calendarButton).toBeInTheDocument()
})
*/

// Empty state (no date selected)
export const Empty = meta.story({
  name: 'Empty (No Date)',
  args: {
    label: 'Select Date',
    value: '',
    onChange: fn(),
  },
})
Empty.test('it is possible to select a date', async ({canvas, userEvent}) => {
  await userEvent.click(canvas.getByRole('button', {name: 'Open calendar', exact: false}))
  await userEvent.click(screen.getByRole('button', {name: 'jeudi 15 janvier 2026'}))

})

// Today's date
export const Today = meta.story({
  name: 'Today',
  args: {
    label: 'Date',
    value: '2026-01-15',
    onChange: fn(),
  },
})

// Different label examples
export const ShortLabel = meta.story({
  name: 'Short Label',
  args: {
    label: 'Date',
    value: '',
    onChange: fn(),
  },
})

export const LongLabel = meta.story({
  name: 'Long Label',
  args: {
    label: 'Please select the date for your paragliding flight',
    value: '2024-03-15',
    onChange: fn(),
  },
})

// In a form context
export const InFormContext = meta.story({
  name: 'In Form Context',
  render: () => {
    const handleChange = fn()
    
    return (
      <form className="space-y-4 w-80 p-6 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Flight Details</h2>
        
        <DatePicker
          label="Flight Date"
          value="2024-03-15"
          onChange={handleChange}
        />
        
        <DatePicker
          label="Next Flight (optional)"
          value=""
          onChange={handleChange}
        />
        
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </form>
    )
  },
})

// Multiple date pickers
export const MultiplePickers = meta.story({
  name: 'Multiple Pickers',
  render: () => {
    return (
      <div className="space-y-4 w-80">
        <DatePicker
          label="Start Date"
          value="2024-03-01"
          onChange={fn()}
        />
        
        <DatePicker
          label="End Date"
          value="2024-03-15"
          onChange={fn()}
        />
      </div>
    )
  },
})

