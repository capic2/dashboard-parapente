import {
  Select as AriaSelect,
  SelectValue,
  Label,
  Button,
  Popover,
  ListBox,
  ListBoxItem,
} from 'react-aria-components';
import type { Key } from 'react-aria-components';

export interface SelectOption {
  id: string;
  label: string;
}

interface SelectProps {
  label: string;
  options: SelectOption[];
  value: Key | null;
  onChange: (value: Key | null) => void;
  placeholder?: string;
}

export function Select({
  label,
  options,
  value,
  onChange,
  placeholder,
}: SelectProps) {
  return (
    <AriaSelect
      onChange={onChange}
      value={value}
      className="flex flex-col gap-1.5"
    >
      <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </Label>
      <Button className="flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:border-transparent transition-shadow hover:border-gray-400 dark:hover:border-gray-500">
        <SelectValue className="truncate placeholder-shown:text-gray-400 dark:placeholder-shown:text-gray-500" />
        <svg
          className="w-4 h-4 ml-2 text-gray-400 dark:text-gray-500 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m19.5 8.25-7.5 7.5-7.5-7.5"
          />
        </svg>
      </Button>
      <Popover className="w-(--trigger-width) bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 mt-1 overflow-hidden">
        <ListBox className="max-h-60 overflow-y-auto p-1 outline-none">
          {placeholder && (
            <ListBoxItem
              id=""
              textValue={placeholder}
              className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500 italic rounded cursor-pointer outline-none hover:bg-gray-100 dark:hover:bg-gray-700 selected:bg-sky-50 dark:selected:bg-sky-900/20 selected:text-sky-700 dark:selected:text-sky-400 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-600"
            >
              {placeholder}
            </ListBoxItem>
          )}
          {options.map((option) => (
            <ListBoxItem
              key={option.id}
              id={option.id}
              textValue={option.label}
              className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100 rounded cursor-pointer outline-none hover:bg-gray-100 dark:hover:bg-gray-700 selected:bg-sky-50 dark:selected:bg-sky-900/20 selected:text-sky-700 dark:selected:text-sky-400 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-600"
            >
              {option.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}
