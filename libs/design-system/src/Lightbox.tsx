import { useState, useEffect } from 'react';
import { Dialog, Modal, ModalOverlay, Button } from 'react-aria-components';
import { tv } from 'tailwind-variants';

const lightbox = tv({
  slots: {
    overlay:
      'fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm',
    root: 'relative max-w-[90vw] max-h-[90vh] flex flex-col items-center',
    closeButton:
      'absolute -top-3 -right-3 z-10 w-8 h-8 flex cursor-pointer items-center justify-center bg-white dark:bg-gray-800 rounded-full shadow-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
    image: 'max-w-[90vw] max-h-[80vh] object-contain rounded-lg shadow-2xl',
    footer: 'mt-3 flex items-center gap-4',
    navButton:
      'w-8 h-8 flex cursor-pointer items-center justify-center bg-white/90 dark:bg-gray-800/90 rounded-full shadow text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
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

  const safeIndex = Math.min(Math.max(index, 0), images.length - 1);
  const current = images[safeIndex];
  const hasPrev = safeIndex > 0;
  const hasNext = safeIndex < images.length - 1;
  const multi = images.length > 1;
  const styles = lightbox();

  const goToPrev = () => {
    if (hasPrev) setIndex(safeIndex - 1);
  };
  const goToNext = () => {
    if (hasNext) setIndex(safeIndex + 1);
  };

  const closeIcon = (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
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
  );
  const prevIcon = (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 19.5 8.25 12l7.5-7.5"
      />
    </svg>
  );
  const nextIcon = (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m8.25 4.5 7.5 7.5-7.5 7.5"
      />
    </svg>
  );

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
              {closeIcon}
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
                  {prevIcon}
                </Button>
              )}
              <span className={styles.caption()}>
                {current.alt}
                {multi && ` (${safeIndex + 1}/${images.length})`}
              </span>
              {multi && (
                <Button
                  aria-label="Image suivante"
                  onPress={goToNext}
                  isDisabled={!hasNext}
                  className={lightbox({ disabled: !hasNext }).navButton()}
                >
                  {nextIcon}
                </Button>
              )}
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
