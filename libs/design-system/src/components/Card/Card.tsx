import type { HTMLAttributes, ReactNode } from 'react';
import { tv, type VariantProps } from 'tailwind-variants';
import { twMerge } from 'tailwind-merge';

const cardStyles = tv({
  base: 'relative overflow-hidden rounded-lg border bg-white shadow-sm transition-all duration-200 dark:bg-gray-800',
  variants: {
    tone: {
      neutral: 'border-gray-200 dark:border-gray-700',
      selected:
        'border-sky-700 bg-sky-100 shadow-lg ring-2 ring-sky-500/40 dark:border-sky-300 dark:bg-sky-950/70 dark:ring-sky-300/35',
    },
    interactive: {
      true: 'cursor-pointer hover:border-sky-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900',
      false: '',
    },
    padding: {
      none: '',
      sm: 'p-3',
      md: 'p-4',
    },
    borderWidth: {
      default: 'border',
      strong: 'border-2',
    },
  },
  defaultVariants: {
    tone: 'neutral',
    interactive: false,
    padding: 'md',
    borderWidth: 'default',
  },
});

type CardVariants = VariantProps<typeof cardStyles>;

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  selected?: boolean;
  interactive?: boolean;
  padding?: CardVariants['padding'];
  borderWidth?: CardVariants['borderWidth'];
}

export function Card({
  children,
  className,
  selected = false,
  interactive = false,
  padding,
  borderWidth,
  ...props
}: CardProps) {
  return (
    <div
      {...props}
      className={twMerge(
        cardStyles({
          tone: selected ? 'selected' : 'neutral',
          interactive,
          padding,
          borderWidth,
        }),
        className
      )}
    >
      {children}
    </div>
  );
}
