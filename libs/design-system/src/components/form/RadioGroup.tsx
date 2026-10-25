import {
  FieldError as AriaFieldError,
  Label as AriaLabel,
  RadioButton as AriaRadioButton,
  RadioField as AriaRadioField,
  RadioGroup as AriaRadioGroup,
  Text as AriaText,
} from 'react-aria-components';
import type { ComponentProps, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import {
  choiceDescriptionClassName,
  choiceLabelClassName,
  fieldContainerClassName,
  fieldDescriptionClassName,
  fieldErrorClassName,
  fieldLabelClassName,
} from './formStyles';

export interface RadioGroupOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  isDisabled?: boolean;
}

export interface RadioGroupProps extends Omit<
  ComponentProps<typeof AriaRadioGroup>,
  'children' | 'className'
> {
  label: ReactNode;
  options: RadioGroupOption[];
  description?: ReactNode;
  errorMessage?: ReactNode;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function RadioGroup({
  label,
  options,
  description,
  errorMessage,
  orientation = 'vertical',
  className,
  isInvalid,
  ...props
}: RadioGroupProps) {
  const invalid = isInvalid ?? errorMessage !== undefined;

  return (
    <AriaRadioGroup
      {...props}
      orientation={orientation}
      isInvalid={invalid}
      className={twMerge(fieldContainerClassName, className)}
    >
      <AriaLabel className={fieldLabelClassName}>{label}</AriaLabel>
      <div
        className={`flex gap-3 ${orientation === 'horizontal' ? 'flex-row flex-wrap' : 'flex-col'}`}
      >
        {options.map((option) => (
          <AriaRadioField
            key={option.value}
            value={option.value}
            isDisabled={option.isDisabled}
            className="flex flex-col gap-1.5"
          >
            <AriaRadioButton className="group inline-flex cursor-pointer items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-400 bg-white outline-none transition-colors group-data-[selected]:border-sky-600 group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-sky-500/40 group-data-[disabled]:cursor-not-allowed group-data-[disabled]:opacity-50 dark:border-gray-500 dark:bg-gray-800 dark:group-data-[selected]:border-sky-400"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-sky-600 opacity-0 group-data-[selected]:opacity-100 dark:bg-sky-400" />
              </span>
              <span className={choiceLabelClassName}>{option.label}</span>
            </AriaRadioButton>
            {option.description && (
              <AriaText
                slot="description"
                className={choiceDescriptionClassName}
              >
                {option.description}
              </AriaText>
            )}
          </AriaRadioField>
        ))}
      </div>
      {description && (
        <AriaText slot="description" className={fieldDescriptionClassName}>
          {description}
        </AriaText>
      )}
      <AriaFieldError className={fieldErrorClassName}>
        {errorMessage}
      </AriaFieldError>
    </AriaRadioGroup>
  );
}
