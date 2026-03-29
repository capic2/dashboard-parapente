import {
  Dialog,
  Modal as AriaModal,
  ModalOverlay,
  Button,
  Heading,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { tv } from 'tailwind-variants';

const modal = tv({
  base: 'bg-white rounded-xl shadow-2xl w-full max-h-[90vh] overflow-y-auto',
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
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}: ModalProps) {
  const { t } = useTranslation();
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onClose}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <AriaModal className={modal({ size })}>
        <Dialog className="outline-none p-6">
          <div className="flex justify-between items-start mb-4">
            <Heading slot="title" className="text-xl font-bold text-gray-900">
              {title}
            </Heading>
            <Button
              aria-label={t('common.close', 'Close')}
              onPress={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </Button>
          </div>
          {children}
        </Dialog>
      </AriaModal>
    </ModalOverlay>
  );
}
