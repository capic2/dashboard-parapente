import {
  CheckboxButton as AriaCheckboxButton,
  CheckboxField as AriaCheckboxField,
  Text as AriaText,
} from 'react-aria-components';
import type { ComponentProps, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import {
  choiceControlClassName,
  choiceDescriptionClassName,
  choiceLabelClassName,
} from './formStyles';

export interface CheckboxProps extends Omit<
  ComponentProps<typeof AriaCheckboxField>,
  'children' | 'className'
> {
  children: ReactNode;
  description?: ReactNode;
  className?: string;
}

export function Checkbox({
  children,
  description,
  className,
  ...props
}: CheckboxProps) {
  return (
    <AriaCheckboxField
      {...props}
      className={twMerge('flex flex-col gap-1.5', className)}
    >
      <AriaCheckboxButton className="group inline-flex cursor-pointer items-start gap-3">
        <span aria-hidden="true" className={choiceControlClassName}>
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5 opacity-0 group-data-[selected]:opacity-100 group-data-[indeterminate]:hidden"
          >
            <path
              d="m3 8 3.2 3.2L13 4.5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <span className="hidden h-0.5 w-2.5 rounded-full bg-current group-data-[indeterminate]:block" />
        </span>
        <span className={choiceLabelClassName}>{children}</span>
      </AriaCheckboxButton>
      {description && (
        <AriaText slot="description" className={choiceDescriptionClassName}>
          {description}
        </AriaText>
      )}
    </AriaCheckboxField>
  );
}
