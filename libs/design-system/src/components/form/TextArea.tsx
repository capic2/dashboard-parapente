import {
  FieldError as AriaFieldError,
  Label as AriaLabel,
  Text as AriaText,
  TextArea as AriaTextArea,
  TextField as AriaTextField,
} from 'react-aria-components';
import type { ComponentProps, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import {
  fieldContainerClassName,
  fieldControlClassName,
  fieldDescriptionClassName,
  fieldErrorClassName,
  fieldLabelClassName,
} from './formStyles';

type AriaTextFieldProps = Omit<
  ComponentProps<typeof AriaTextField>,
  'children' | 'className'
> & { className?: string };

export interface TextAreaProps extends AriaTextFieldProps {
  label: ReactNode;
  placeholder?: string;
  description?: ReactNode;
  errorMessage?: ReactNode;
  inputClassName?: string;
}

export function TextArea({
  label,
  placeholder,
  description,
  errorMessage,
  inputClassName,
  className,
  isInvalid,
  ...props
}: TextAreaProps) {
  const invalid = isInvalid ?? errorMessage !== undefined;

  return (
    <AriaTextField
      {...props}
      isInvalid={invalid}
      className={twMerge(fieldContainerClassName, className)}
    >
      <AriaLabel className={fieldLabelClassName}>{label}</AriaLabel>
      <AriaTextArea
        placeholder={placeholder}
        className={twMerge(
          fieldControlClassName,
          'min-h-24 resize-y',
          inputClassName
        )}
      />
      {description && (
        <AriaText slot="description" className={fieldDescriptionClassName}>
          {description}
        </AriaText>
      )}
      <AriaFieldError className={fieldErrorClassName}>
        {errorMessage}
      </AriaFieldError>
    </AriaTextField>
  );
}
