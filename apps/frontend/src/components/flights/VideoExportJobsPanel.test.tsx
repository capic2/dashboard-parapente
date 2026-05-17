// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoExportJobsPanel } from './VideoExportJobsPanel';

const {
  cancelJob,
  cleanupTempFiles,
  deleteOutput,
  resumeJob,
  toastError,
  toastSuccess,
  refetch,
  jobs,
} = vi.hoisted(() => ({
  cancelJob: vi.fn(),
  cleanupTempFiles: vi.fn(),
  deleteOutput: vi.fn(),
  resumeJob: vi.fn(),
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
      has_output_file: true,
      can_cancel: false,
    },
    {
      job_id: 'job-overlay',
      flight_title: 'vol-overlay.mp4',
      status: 'running',
      internal_status: 'running',
      progress: 50,
      message: 'Rendering overlay',
      mode: 'gopro_overlay',
      can_cancel: true,
    },
    {
      job_id: 'job-resumable',
      flight_id: 'flight-resumable',
      flight_title: 'Vol relançable',
      status: 'cancelled',
      internal_status: 'cancelled',
      progress: 30,
      can_cancel: false,
      can_resume: true,
    },
    {
      job_id: 'job-overlay-done',
      flight_title: 'final.mp4',
      status: 'completed',
      internal_status: 'completed',
      progress: 100,
      message: 'Overlay ready',
      mode: 'gopro_overlay',
      has_output_file: true,
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
  useResumeVideoExportJob: () => ({
    mutateAsync: resumeJob,
    isPending: false,
  }),
  useDeleteVideoExportOutput: () => ({
    mutateAsync: deleteOutput,
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
        has_output_file: true,
        can_cancel: false,
      },
      {
        job_id: 'job-overlay',
        flight_title: 'vol-overlay.mp4',
        status: 'running',
        internal_status: 'running',
        progress: 50,
        message: 'Rendering overlay',
        mode: 'gopro_overlay',
        can_cancel: true,
      },
      {
        job_id: 'job-resumable',
        flight_id: 'flight-resumable',
        flight_title: 'Vol relançable',
        status: 'cancelled',
        internal_status: 'cancelled',
        progress: 30,
        can_cancel: false,
        can_resume: true,
      },
      {
        job_id: 'job-overlay-done',
        flight_title: 'final.mp4',
        status: 'completed',
        internal_status: 'completed',
        progress: 100,
        message: 'Overlay ready',
        mode: 'gopro_overlay',
        has_output_file: true,
        can_cancel: false,
      }
    );
  });

  it('shows active jobs with a stop action only when cancellable', () => {
    render(<VideoExportJobsPanel />);

    expect(screen.getByText('Générations vidéo')).toBeInTheDocument();
    expect(screen.getAllByText('Vol test').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Vol terminé').length).toBeGreaterThan(0);
    expect(screen.getAllByText('vol-overlay.mp4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('final.mp4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Overlay GoPro').length).toBeGreaterThan(0);
    expect(screen.getAllByText('42%').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Stopper' })).toHaveLength(4);
    expect(
      screen.getAllByRole('link', { name: 'Voir le vol' })[0]
    ).toHaveAttribute('href', '/flights/flight-resumable');
    expect(
      screen.getAllByRole('button', { name: 'Télécharger' }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: 'Reprendre' }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: 'Supprimer l’overlay' }).length
    ).toBeGreaterThan(0);
  });

  it('filters jobs by status', () => {
    render(<VideoExportJobsPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Terminés' }));

    expect(screen.getAllByText('Vol terminé').length).toBeGreaterThan(0);
    expect(screen.queryByText('Vol test')).not.toBeInTheDocument();
    expect(screen.queryByText('vol-overlay.mp4')).not.toBeInTheDocument();
  });

  it('cancels a running job after confirmation', async () => {
    cancelJob.mockResolvedValue(undefined);

    render(<VideoExportJobsPanel />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Stopper' })[0]!);
    const stopButtons = screen.getAllByRole('button', { name: 'Stopper' });
    fireEvent.click(stopButtons[stopButtons.length - 1]!);

    await waitFor(() => expect(cancelJob).toHaveBeenCalledWith('job-active'));
    expect(toastSuccess).toHaveBeenCalledWith('Génération stoppée');
  });

  it('resumes a cancelled export', async () => {
    resumeJob.mockResolvedValue(undefined);

    render(<VideoExportJobsPanel />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Reprendre' })[0]!);

    await waitFor(() =>
      expect(resumeJob).toHaveBeenCalledWith('job-resumable')
    );
    expect(toastSuccess).toHaveBeenCalledWith('Génération relancée');
  });

  it('deletes a generated overlay after confirmation', async () => {
    deleteOutput.mockResolvedValue(undefined);

    render(<VideoExportJobsPanel />);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Supprimer l’overlay' })[0]!
    );
    const deleteButtons = screen.getAllByRole('button', {
      name: 'Supprimer l’overlay',
    });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]!);

    await waitFor(() =>
      expect(deleteOutput).toHaveBeenCalledWith(
        expect.objectContaining({ job_id: 'job-overlay-done' })
      )
    );
    expect(toastSuccess).toHaveBeenCalledWith('Overlay GoPro supprimé');
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
    const cleanupButtons = screen.getAllByRole('button', {
      name: 'Nettoyer les temporaires',
    });
    fireEvent.click(cleanupButtons[cleanupButtons.length - 1]!);

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
