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
  'flex max-w-full gap-2 overflow-x-auto rounded-xl bg-white p-2 shadow-md dark:bg-gray-800 sm:grid sm:overflow-visible';

export const TAB_BASE_CLASS =
  'min-w-max flex-1 cursor-pointer whitespace-nowrap rounded-lg bg-gray-100 px-4 py-2 text-center font-medium text-gray-700 outline-none transition-all hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 data-[selected]:bg-sky-600 data-[selected]:text-white data-[selected]:shadow-md dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:focus-visible:ring-offset-gray-800';

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
