import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoExportJobsPanel } from './VideoExportJobsPanel';

const { cancelJob, toastError, toastSuccess, refetch } = vi.hoisted(() => ({
  cancelJob: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: Record<string, unknown>) =>
      values?.count
        ? fallback.replace('{{count}}', String(values.count))
        : fallback,
  }),
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    error: toastError,
    success: toastSuccess,
  }),
}));

vi.mock('../../hooks/flights/useVideoExportJobs', () => ({
  useVideoExportJobs: () => ({
    data: [
      {
        job_id: 'job-active',
        flight_title: 'Vol test',
        status: 'processing',
        internal_status: 'capturing',
        progress: 42,
        message: 'Capturing frames',
        mode: 'manual_fast',
        can_cancel: true,
      },
      {
        job_id: 'job-done',
        flight_title: 'Vol terminé',
        status: 'completed',
        internal_status: 'completed',
        progress: 100,
        can_cancel: false,
      },
    ],
    isLoading: false,
    isError: false,
    refetch,
  }),
  useCancelVideoExportJob: () => ({
    mutateAsync: cancelJob,
    isPending: false,
  }),
}));

describe('VideoExportJobsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('shows active jobs with a stop action only when cancellable', () => {
    render(<VideoExportJobsPanel />);

    expect(screen.getByText('Générations vidéo')).toBeInTheDocument();
    expect(screen.getByText('Vol test')).toBeInTheDocument();
    expect(screen.getByText('Vol terminé')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Stopper' })).toHaveLength(1);
  });

  it('cancels a running job after confirmation', async () => {
    cancelJob.mockResolvedValue(undefined);

    render(<VideoExportJobsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Stopper' }));

    await waitFor(() => expect(cancelJob).toHaveBeenCalledWith('job-active'));
    expect(toastSuccess).toHaveBeenCalledWith('Génération stoppée');
  });
});
