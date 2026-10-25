import {
  FieldError as AriaFieldError,
  Input as AriaInput,
  Label as AriaLabel,
  Text as AriaText,
  TextField as AriaTextField,
} from 'react-aria-components';
import type {
  ComponentProps,
  HTMLInputAutoCompleteAttribute,
  HTMLInputTypeAttribute,
  ReactNode,
} from 'react';
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

export interface TextFieldProps extends AriaTextFieldProps {
  label: ReactNode;
  placeholder?: string;
  type?: HTMLInputTypeAttribute;
  autoComplete?: HTMLInputAutoCompleteAttribute;
  description?: ReactNode;
  errorMessage?: ReactNode;
  inputClassName?: string;
}

export function TextField({
  label,
  placeholder,
  type,
  autoComplete,
  description,
  errorMessage,
  inputClassName,
  className,
  isInvalid,
  ...props
}: TextFieldProps) {
  const invalid = isInvalid ?? errorMessage !== undefined;

  return (
    <AriaTextField
      {...props}
      isInvalid={invalid}
      className={twMerge(fieldContainerClassName, className)}
    >
      <AriaLabel className={fieldLabelClassName}>{label}</AriaLabel>
      <AriaInput
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={twMerge(fieldControlClassName, inputClassName)}
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
