import { useEffect } from 'react';
import { tv } from 'tailwind-variants';

const toast = tv({
  base: 'text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 w-full sm:min-w-[300px] sm:max-w-sm',
  variants: {
    type: {
      success: 'bg-green-600',
      error: 'bg-red-600',
      info: 'bg-blue-600',
    },
  },
});

type ToastType = 'success' | 'error' | 'info';

function ToastIcon({ type }: { type: ToastType }) {
  const path = {
    success: 'm4.5 12.75 6 6 9-13.5',
    error: 'M6 18 18 6M6 6l12 12',
    info: 'M11.25 11.25h1.5v6h-1.5zM12 7.5h.008v.008H12z',
  }[type];

  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

interface ToastProps {
  id: string;
  title: string;
  type: ToastType;
  onClose: (id: string) => void;
  autoDismissMs?: number | false;
}

export function Toast({
  id,
  title,
  type,
  onClose,
  autoDismissMs = 5000,
}: ToastProps) {
  useEffect(() => {
    if (autoDismissMs === false) {
      return undefined;
    }

    const timeout = window.setTimeout(() => onClose(id), autoDismissMs);
    return () => window.clearTimeout(timeout);
  }, [autoDismissMs, id, onClose]);

  return (
    <div
      className={toast({ type })}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      <ToastIcon type={type} />
      <span className="font-medium flex-1">{title}</span>
      <button
        type="button"
        aria-label="Fermer la notification"
        onClick={() => onClose(id)}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      >
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
      </button>
    </div>
  );
}

// Container pour tous les toasts
interface ToastContainerProps {
  toasts: {
    id: string;
    title: string;
    type: 'success' | 'error' | 'info';
  }[];
  onClose: (id: string) => void;
  autoDismissMs?: number | false;
}

export function ToastContainer({
  toasts,
  onClose,
  autoDismissMs,
}: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 sm:left-auto sm:right-4 sm:w-auto">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={onClose}
          autoDismissMs={autoDismissMs}
        />
      ))}
    </div>
  );
}
