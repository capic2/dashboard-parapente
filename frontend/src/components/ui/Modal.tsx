import { 
  Dialog, 
  Modal as AriaModal, 
  ModalOverlay, 
  Button,
  Heading
} from 'react-aria-components';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onClose}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <AriaModal className={`bg-white rounded-xl shadow-2xl ${sizeClasses[size]} w-full max-h-[90vh] overflow-y-auto`}>
        <Dialog className="outline-none p-6">
          <div className="flex justify-between items-start mb-4">
            <Heading slot="title" className="text-xl font-bold text-gray-900">
              {title}
            </Heading>
            <Button
                aria-label="Fermer"
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
