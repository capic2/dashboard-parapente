import {
  Dialog,
  Modal as AriaModal,
  ModalOverlay,
  Button,
  Heading,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { tv } from 'tailwind-variants';
import type { ReactNode } from 'react';

const modal = tv({
  base: 'bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-h-[90vh] overflow-y-auto',
  variants: {
    size: {
      sm: 'max-w-md',
      md: 'max-w-lg',
      lg: 'max-w-2xl',
      xl: 'max-w-4xl',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  role?: 'dialog' | 'alertdialog';
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  role = 'dialog',
}: ModalProps) {
  const { t } = useTranslation();
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onClose}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <AriaModal className={modal({ size })}>
        <Dialog role={role} className="outline-none p-6">
          <div className="flex justify-between items-start mb-4">
            <Heading
              slot="title"
              className="text-xl font-bold text-gray-900 dark:text-white"
            >
              {title}
            </Heading>
            <Button
              aria-label={t('common.close', 'Close')}
              onPress={onClose}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </Button>
          </div>
          {children}
        </Dialog>
      </AriaModal>
    </ModalOverlay>
  );
}
