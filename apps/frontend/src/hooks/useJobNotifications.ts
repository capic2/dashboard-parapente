import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './useToast';
import { useOperations } from './useOperations';

export function requestJobNotificationPermission(): Promise<NotificationPermission | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return Promise.resolve(null);
  }
  return Notification.requestPermission();
}

function sendSystemNotification(title: string, body: string) {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return;
  }

  const notification = new Notification(title, {
    body,
    tag: `job-${title}-${body}`,
  });
  notification.onclick = () => window.focus();
}

export function useOperationCompletionNotifications() {
  const { t } = useTranslation();
  const { success, error, info } = useToast();
  const queryClient = useQueryClient();
  const { data: operations = [], isSuccess } = useOperations();
  const previousStatuses = useRef<Map<string, string>>(new Map());
  const hasInitialSnapshot = useRef(false);

  useEffect(() => {
    if (!isSuccess) return;
    const nextStatuses = new Map(
      operations.map((operation) => [operation.operation_id, operation.status])
    );
    if (!hasInitialSnapshot.current) {
      previousStatuses.current = nextStatuses;
      hasInitialSnapshot.current = true;
      return;
    }

    for (const operation of operations) {
      const previousStatus = previousStatuses.current.get(
        operation.operation_id
      );
      if (
        previousStatus === operation.status ||
        !['completed', 'failed', 'cancelled'].includes(operation.status)
      ) {
        continue;
      }
      const label = t(operation.title_key, operation.operation_type);
      const title = t(
        `operations.status.${operation.status}`,
        operation.status
      );
      const body = operation.error_detail || label;
      if (operation.status === 'failed') error(`${title} : ${body}`);
      else if (operation.status === 'completed') success(`${title} : ${body}`);
      else info(`${title} : ${body}`);
      if (
        operation.status === 'completed' &&
        operation.operation_type === 'intervals_sync'
      ) {
        void queryClient.invalidateQueries({ queryKey: ['flights'] });
        void queryClient.invalidateQueries({ queryKey: ['flights', 'stats'] });
        void queryClient.invalidateQueries({
          queryKey: ['flights', 'records'],
        });
      }
      sendSystemNotification(title, body);
    }
    previousStatuses.current = nextStatuses;
  }, [error, info, isSuccess, operations, queryClient, success, t]);
}
