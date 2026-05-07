import { useState, useEffect } from 'react';
import { Dialog, Modal, ModalOverlay, Button } from 'react-aria-components';
import { tv } from 'tailwind-variants';

const lightbox = tv({
  slots: {
    overlay:
      'fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm',
    root: 'relative max-w-[90vw] max-h-[90vh] flex flex-col items-center',
    closeButton:
      'absolute -top-3 -right-3 z-10 w-8 h-8 flex items-center justify-center bg-white dark:bg-gray-800 rounded-full shadow-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-lg font-bold',
    image: 'max-w-[90vw] max-h-[80vh] object-contain rounded-lg shadow-2xl',
    footer: 'mt-3 flex items-center gap-4',
    navButton:
      'w-8 h-8 flex items-center justify-center bg-white/90 dark:bg-gray-800/90 rounded-full shadow text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 transition-colors',
    caption:
      'text-sm text-white font-medium px-3 py-1 bg-black/40 rounded-full',
  },
  variants: {
    disabled: {
      true: {
        navButton: 'opacity-30 cursor-default',
      },
    },
  },
});

interface LightboxImage {
  src: string;
  alt: string;
}

interface LightboxProps {
  isOpen: boolean;
  onClose: () => void;
  images: LightboxImage[];
  initialIndex?: number;
}

export function Lightbox({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
}: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (isOpen) setIndex(initialIndex);
  }, [isOpen, initialIndex]);

  if (images.length === 0) return null;

  const current = images[Math.min(index, images.length - 1)];
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;
  const multi = images.length > 1;
  const styles = lightbox();

  const goToPrev = () => {
    if (hasPrev) setIndex(index - 1);
  };
  const goToNext = () => {
    if (hasNext) setIndex(index + 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goToPrev();
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goToNext();
    }
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className={styles.overlay()}
    >
      <Modal className="outline-none">
        <Dialog className="outline-none">
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div className={styles.root()} onKeyDown={handleKeyDown}>
            <Button
              aria-label="Fermer"
              onPress={onClose}
              className={styles.closeButton()}
            >
              ✕
            </Button>

            <img
              src={current.src}
              alt={current.alt}
              className={styles.image()}
            />

            <div className={styles.footer()}>
              {multi && (
                <Button
                  aria-label="Image précédente"
                  onPress={goToPrev}
                  isDisabled={!hasPrev}
                  className={lightbox({ disabled: !hasPrev }).navButton()}
                >
                  ←
                </Button>
              )}
              <span className={styles.caption()}>
                {current.alt}
                {multi && ` (${index + 1}/${images.length})`}
              </span>
              {multi && (
                <Button
                  aria-label="Image suivante"
                  onPress={goToNext}
                  isDisabled={!hasNext}
                  className={lightbox({ disabled: !hasNext }).navButton()}
                >
                  →
                </Button>
              )}
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
