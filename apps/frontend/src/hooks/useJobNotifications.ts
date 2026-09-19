import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useToast } from './useToast';
import {
  videoExportJobsQueryOptions,
  type VideoExportJob,
} from './flights/useVideoExportJobs';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const JOB_NOTIFICATION_PAGE_SIZE = 100;

function jobLabel(job: VideoExportJob): string {
  return (
    job.flight_title ||
    job.flight_name ||
    job.output_filename ||
    job.layout_label ||
    job.job_id
  );
}

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

export function useJobCompletionNotifications() {
  const { t } = useTranslation();
  const { success, error, info } = useToast();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const previousStatuses = useRef<Map<string, string>>(new Map());
  const hasInitialSnapshot = useRef(false);
  const jobsQuery = useQuery({
    ...videoExportJobsQueryOptions({ pageSize: JOB_NOTIFICATION_PAGE_SIZE }),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      previousStatuses.current = new Map();
      hasInitialSnapshot.current = false;
      return;
    }
    if (!jobsQuery.data) return;

    const nextStatuses = new Map(
      jobsQuery.data.jobs.map((job) => [job.job_id, job.status])
    );

    if (!hasInitialSnapshot.current) {
      previousStatuses.current = nextStatuses;
      hasInitialSnapshot.current = true;
      return;
    }

    for (const job of jobsQuery.data.jobs) {
      const previousStatus = previousStatuses.current.get(job.job_id);
      if (previousStatus === job.status || !TERMINAL_STATUSES.has(job.status)) {
        continue;
      }

      const label = jobLabel(job);
      const isSuccess = job.status === 'completed';
      const isFailure = job.status === 'failed';
      let title: string;
      let body: string;
      if (isSuccess) {
        title = t('notifications.jobCompleted', 'Job terminé');
        body = t('notifications.jobCompletedDetail', '{{job}} est terminé', {
          job: label,
        });
      } else if (isFailure) {
        title = t('notifications.jobFailed', 'Job échoué');
        body = t('notifications.jobFailedDetail', '{{job}} a échoué', {
          job: label,
        });
      } else {
        title = t('notifications.jobCancelled', 'Job annulé');
        body = t('notifications.jobCancelledDetail', '{{job}} a été annulé', {
          job: label,
        });
      }

      if (isFailure) error(`${title} : ${body}`);
      else if (isSuccess) success(`${title} : ${body}`);
      else info(`${title} : ${body}`);
      sendSystemNotification(title, body);
    }

    previousStatuses.current = nextStatuses;
  }, [error, info, isAuthenticated, jobsQuery.data, success, t]);
}
