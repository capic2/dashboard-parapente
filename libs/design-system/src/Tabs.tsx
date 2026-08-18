import {
  composeRenderProps,
  Tab as AriaTab,
  TabList as AriaTabList,
  TabPanel as AriaTabPanel,
  Tabs as AriaTabs,
} from 'react-aria-components';
import type {
  TabListProps,
  TabPanelProps,
  TabProps,
  TabsProps,
} from 'react-aria-components';
import { twMerge } from 'tailwind-merge';

export const TAB_LIST_BASE_CLASS =
  'flex max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-200/80 bg-gray-100/80 p-1 dark:border-gray-700/80 dark:bg-gray-900/70 sm:overflow-visible';

export const TAB_BASE_CLASS =
  'inline-flex min-h-10 min-w-max flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-center text-sm font-semibold text-gray-600 outline-none transition-[color,background-color,box-shadow] duration-200 hover:bg-white/60 hover:text-gray-950 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[selected]:bg-white data-[selected]:text-sky-700 data-[selected]:shadow-sm data-[selected]:ring-1 data-[selected]:ring-black/5 motion-reduce:transition-none dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white dark:focus-visible:ring-offset-gray-900 dark:data-[selected]:bg-gray-700 dark:data-[selected]:text-sky-300 dark:data-[selected]:ring-white/10';

export function Tabs({ className, ...props }: TabsProps) {
  return (
    <AriaTabs
      {...props}
      className={composeRenderProps(className, (className) =>
        twMerge('space-y-4', className)
      )}
    />
  );
}

export function TabList<T extends object>({
  className,
  ...props
}: TabListProps<T>) {
  return (
    <AriaTabList
      {...props}
      className={composeRenderProps(className, (className) =>
        twMerge(TAB_LIST_BASE_CLASS, className)
      )}
    />
  );
}

export function Tab({ className, ...props }: TabProps) {
  return (
    <AriaTab
      {...props}
      className={composeRenderProps(className, (className) =>
        twMerge(TAB_BASE_CLASS, className)
      )}
    />
  );
}

export function TabPanel({ className, ...props }: TabPanelProps) {
  return (
    <AriaTabPanel
      {...props}
      className={composeRenderProps(className, (className) =>
        twMerge(
          'outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800',
          className
        )
      )}
    />
  );
}
