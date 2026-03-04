import { Label } from 'react-aria-components';

interface DatePickerProps {
  label: string;
  value: string; // Format: YYYY-MM-DD
  onChange: (value: string) => void;
}

export function DatePicker({ label, value, onChange }: DatePickerProps) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="block text-sm font-medium text-gray-700">
        {label}
      </Label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
      />
    </div>
  );
}
