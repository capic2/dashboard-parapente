import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';
import { twMerge } from 'tailwind-merge';

const buttonStyles = tv({
  base: 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 disabled:pointer-events-none disabled:opacity-50',
  variants: {
    tone: {
      primary:
        'bg-sky-600 text-white hover:bg-sky-700 [&[data-pressed]]:bg-sky-800 shadow-sm',
      secondary:
        'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600',
      success:
        'bg-green-600 text-white hover:bg-green-700 [&[data-pressed]]:bg-green-800 shadow-sm',
      warning:
        'bg-orange-600 text-white hover:bg-orange-700 [&[data-pressed]]:bg-orange-800 shadow-sm',
      danger:
        'bg-red-600 text-white hover:bg-red-700 [&[data-pressed]]:bg-red-800 shadow-sm',
      accent:
        'bg-purple-600 text-white hover:bg-purple-700 [&[data-pressed]]:bg-purple-800 shadow-sm',
      cyan: 'bg-cyan-500 text-white hover:bg-cyan-600 [&[data-pressed]]:bg-cyan-700 shadow-sm',
      ghost:
        'bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
      outline:
        'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700',
    },
    size: {
      sm: 'min-h-10 px-3 py-2 text-xs sm:min-h-0 sm:py-1.5',
      md: 'min-h-11 px-4 py-2.5 text-sm sm:min-h-0 sm:py-2',
      lg: 'min-h-12 px-5 py-3 text-base sm:min-h-0 sm:py-3',
      icon: 'min-h-10 min-w-10 px-0 py-0 text-sm sm:min-h-0',
    },
    fullWidth: {
      true: 'w-full',
      false: '',
    },
  },
  defaultVariants: {
    tone: 'primary',
    size: 'md',
    fullWidth: false,
  },
});

export interface ButtonProps extends AriaButtonProps {
  tone?:
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'accent'
    | 'cyan'
    | 'ghost'
    | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  fullWidth?: boolean;
  className?: string;
  disabled?: boolean;
  isDisabled?: boolean;
  title?: string;
}

export function Button({
  className,
  tone,
  size,
  fullWidth,
  isDisabled,
  disabled,
  ...props
}: ButtonProps) {
  const type = props.type ?? 'button';
  const finalDisabled = isDisabled ?? disabled;

  return (
    <AriaButton
      {...props}
      type={type}
      isDisabled={finalDisabled}
      className={twMerge(buttonStyles({ tone, size, fullWidth }), className)}
    />
  );
}
