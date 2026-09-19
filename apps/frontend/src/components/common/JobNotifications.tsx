import { ToastContainer } from '@dashboard-parapente/design-system';
import { useToastStore } from '../../hooks/useToast';
import { useJobCompletionNotifications } from '../../hooks/useJobNotifications';

export function JobNotifications() {
  useJobCompletionNotifications();
  const { toasts, removeToast } = useToastStore();

  return <ToastContainer toasts={toasts} onClose={removeToast} />;
}
