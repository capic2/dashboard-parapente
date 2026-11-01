import {
  SwitchButton as AriaSwitchButton,
  SwitchField as AriaSwitchField,
  Text as AriaText,
} from 'react-aria-components';
import type { ComponentProps, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import { choiceDescriptionClassName, choiceLabelClassName } from './formStyles';

export interface SwitchProps extends Omit<
  ComponentProps<typeof AriaSwitchField>,
  'children' | 'className'
> {
  children: ReactNode;
  description?: ReactNode;
  className?: string;
}

export function Switch({
  children,
  description,
  className,
  ...props
}: SwitchProps) {
  return (
    <AriaSwitchField
      {...props}
      className={twMerge('flex flex-col gap-1.5', className)}
    >
      <AriaSwitchButton className="group inline-flex cursor-pointer items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full bg-gray-300 p-0.5 transition-colors group-data-[selected]:bg-sky-600 group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-sky-500/40 group-data-[disabled]:cursor-not-allowed group-data-[disabled]:opacity-50 dark:bg-gray-600 dark:group-data-[selected]:bg-sky-500"
        >
          <span className="h-4 w-4 rounded-full bg-white shadow-sm transition-transform group-data-[selected]:translate-x-4" />
        </span>
        <span className={choiceLabelClassName}>{children}</span>
      </AriaSwitchButton>
      {description && (
        <AriaText slot="description" className={choiceDescriptionClassName}>
          {description}
        </AriaText>
      )}
    </AriaSwitchField>
  );
}
