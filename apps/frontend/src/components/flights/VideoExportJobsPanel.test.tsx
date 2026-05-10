// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoExportJobsPanel } from './VideoExportJobsPanel';

const { cancelJob, cleanupTempFiles, toastError, toastSuccess, refetch, jobs } =
  vi.hoisted(() => ({
    cancelJob: vi.fn(),
    cleanupTempFiles: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    refetch: vi.fn(),
    jobs: [
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
  }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: Record<string, unknown>) =>
      values?.count
        ? fallback.replace('{{count}}', String(values.count))
        : fallback,
  }),
  withTranslation: () => (Component: React.ComponentType) => Component,
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    error: toastError,
    success: toastSuccess,
  }),
}));

vi.mock('../../hooks/flights/useVideoExportJobs', () => ({
  useVideoExportJobs: () => ({
    data: jobs,
    isLoading: false,
    isError: false,
    refetch,
  }),
  useCancelVideoExportJob: () => ({
    mutateAsync: cancelJob,
    isPending: false,
  }),
  useCleanupVideoExportTempFiles: () => ({
    mutateAsync: cleanupTempFiles,
    isPending: false,
  }),
}));

describe('VideoExportJobsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jobs.splice(
      0,
      jobs.length,
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
      }
    );
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
    fireEvent.click(screen.getAllByRole('button', { name: 'Stopper' }).at(-1)!);

    await waitFor(() => expect(cancelJob).toHaveBeenCalledWith('job-active'));
    expect(toastSuccess).toHaveBeenCalledWith('Génération stoppée');
  });

  it('cleans temporary files after confirmation', async () => {
    cleanupTempFiles.mockResolvedValue({
      files_deleted: 2,
      dirs_deleted: 1,
      bytes_deleted: 123,
      paths_deleted: ['/tmp/export-temp'],
      errors: [],
    });

    render(<VideoExportJobsPanel />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Nettoyer les temporaires' })
    );
    fireEvent.click(
      screen
        .getAllByRole('button', { name: 'Nettoyer les temporaires' })
        .at(-1)!
    );

    await waitFor(() => expect(cleanupTempFiles).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalledWith(
      '3 élément(s) temporaire(s) supprimé(s)'
    );
  });

  it('shows an empty state when there are no jobs', () => {
    jobs.splice(0, jobs.length);

    render(<VideoExportJobsPanel />);

    expect(
      screen.getByText('Aucune génération vidéo pour le moment.')
    ).toBeInTheDocument();
  });
});
