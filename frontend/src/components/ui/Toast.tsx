interface ToastProps {
  id: string;
  title: string;
  type: 'success' | 'error' | 'info';
  onClose: (id: string) => void;
}

export function Toast({ id, title, type, onClose }: ToastProps) {
  const colors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600'
  };

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };

  return (
    <div className={`${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px]`}>
      <span className="text-xl font-bold">{icons[type]}</span>
      <span className="font-medium flex-1">{title}</span>
      <button
        onClick={() => onClose(id)}
        className="text-white/80 hover:text-white text-xl leading-none"
      >
        ×
      </button>
    </div>
  );
}

// Container pour tous les toasts
interface ToastContainerProps {
  toasts: Array<{ id: string; title: string; type: 'success' | 'error' | 'info' }>;
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  );
}
