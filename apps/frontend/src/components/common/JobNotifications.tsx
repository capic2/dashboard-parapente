import { ToastContainer } from '@dashboard-parapente/design-system';
import { useToastStore } from '../../hooks/useToast';
import { useOperationCompletionNotifications } from '../../hooks/useJobNotifications';

export function JobNotifications() {
  useOperationCompletionNotifications();
  const { toasts, removeToast } = useToastStore();

  return <ToastContainer toasts={toasts} onClose={removeToast} />;
}
