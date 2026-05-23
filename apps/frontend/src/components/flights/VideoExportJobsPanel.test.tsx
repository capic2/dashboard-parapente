// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoExportJobsPanel } from './VideoExportJobsPanel';

const {
  cancelJob,
  cleanupTempFiles,
  deleteJobRow,
  resumeJob,
  toastError,
  toastSuccess,
  refetch,
  jobs,
} = vi.hoisted(() => ({
  cancelJob: vi.fn(),
  cleanupTempFiles: vi.fn(),
  deleteJobRow: vi.fn(),
  resumeJob: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  refetch: vi.fn(),
  jobs: [
    {
      job_id: 'job-active',
      flight_name: 'Nom du vol test',
      flight_title: 'Vol test',
      status: 'processing',
      internal_status: 'capturing',
      progress: 42,
      message: 'Capturing frames',
      mode: 'manual_fast',
      can_cancel: true,
      can_delete: true,
    },
    {
      job_id: 'job-done',
      flight_title: 'Vol terminé',
      status: 'completed',
      internal_status: 'completed',
      progress: 100,
      has_output_file: true,
      can_cancel: false,
      can_delete: true,
    },
    {
      job_id: 'job-overlay',
      flight_name: 'Nom du vol overlay',
      flight_title: 'vol-overlay.mp4',
      status: 'running',
      internal_status: 'running',
      progress: 50,
      message: 'Rendering overlay',
      mode: 'gopro_overlay',
      can_cancel: true,
      can_delete: false,
    },
    {
      job_id: 'job-resumable',
      flight_id: 'flight-resumable',
      flight_title: 'Vol relançable',
      status: 'cancelled',
      internal_status: 'cancelled',
      progress: 30,
      can_cancel: false,
      can_delete: true,
      can_resume: true,
    },
    {
      job_id: 'job-overlay-done',
      flight_name: 'Nom du vol overlay terminé',
      flight_title: 'final.mp4',
      status: 'completed',
      internal_status: 'completed',
      progress: 100,
      message: 'Overlay ready',
      mode: 'gopro_overlay',
      has_output_file: true,
      can_cancel: false,
      can_delete: true,
    },
  ],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: Record<string, unknown>) => {
      if (!values) {
        return fallback;
      }

      return Object.entries(values).reduce(
        (label, [key, value]) => label.replace(`{{${key}}}`, String(value)),
        fallback
      );
    },
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
  useDeleteVideoExportJobRow: () => ({
    mutateAsync: deleteJobRow,
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
        flight_name: 'Nom du vol test',
        flight_title: 'Vol test',
        status: 'processing',
        internal_status: 'capturing',
        progress: 42,
        message: 'Capturing frames',
        mode: 'manual_fast',
        can_cancel: true,
        can_delete: true,
      },
      {
        job_id: 'job-done',
        flight_title: 'Vol terminé',
        status: 'completed',
        internal_status: 'completed',
        progress: 100,
        has_output_file: true,
        can_cancel: false,
        can_delete: true,
      },
      {
        job_id: 'job-overlay',
        flight_name: 'Nom du vol overlay',
        flight_title: 'vol-overlay.mp4',
        status: 'running',
        internal_status: 'running',
        progress: 50,
        message: 'Rendering overlay',
        mode: 'gopro_overlay',
        can_cancel: true,
        can_delete: false,
      },
      {
        job_id: 'job-resumable',
        flight_id: 'flight-resumable',
        flight_title: 'Vol relançable',
        status: 'cancelled',
        internal_status: 'cancelled',
        progress: 30,
        can_cancel: false,
        can_delete: true,
        can_resume: true,
      },
      {
        job_id: 'job-overlay-done',
        flight_name: 'Nom du vol overlay terminé',
        flight_title: 'final.mp4',
        status: 'completed',
        internal_status: 'completed',
        progress: 100,
        message: 'Overlay ready',
        mode: 'gopro_overlay',
        has_output_file: true,
        can_cancel: false,
        can_delete: true,
      }
    );
  });

  it('shows active jobs with a stop action only when cancellable', () => {
    render(<VideoExportJobsPanel />);

    expect(screen.getByText('Générations vidéo')).toBeInTheDocument();
    expect(screen.getAllByText('Nom du vol test').length).toBeGreaterThan(0);
    expect(screen.queryByText('Vol test')).not.toBeInTheDocument();
    expect(screen.getAllByText('Vol terminé').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nom du vol overlay').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Nom du vol overlay terminé').length
    ).toBeGreaterThan(0);
    expect(screen.queryByText('vol-overlay.mp4')).not.toBeInTheDocument();
    expect(screen.queryByText('final.mp4')).not.toBeInTheDocument();
    expect(screen.getAllByText('Overlay GoPro').length).toBeGreaterThan(0);
    expect(screen.getAllByText('42%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('En cours').length).toBeGreaterThan(1);
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
      screen.getAllByRole('button', { name: 'Supprimer' }).length
    ).toBeGreaterThan(0);
  });

  it('filters jobs by status', () => {
    render(<VideoExportJobsPanel />);

    fireEvent.click(screen.getByRole('button', { name: /Terminés/u }));

    expect(screen.getAllByText('Vol terminé').length).toBeGreaterThan(0);
    expect(screen.queryByText('Nom du vol test')).not.toBeInTheDocument();
    expect(screen.queryByText('Nom du vol overlay')).not.toBeInTheDocument();
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

  it('filters jobs by type', () => {
    render(<VideoExportJobsPanel />);

    fireEvent.click(screen.getByRole('button', { name: /Overlay GoPro/u }));

    expect(screen.getAllByText('Nom du vol overlay').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Nom du vol overlay terminé').length
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Nom du vol test')).not.toBeInTheDocument();
  });

  it('resets active filters', () => {
    render(<VideoExportJobsPanel />);

    fireEvent.click(screen.getByRole('button', { name: /Overlay GoPro/u }));
    expect(screen.queryByText('Vol test')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));

    expect(screen.getAllByText('Nom du vol test').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nom du vol overlay').length).toBeGreaterThan(0);
  });

  it('deletes an inactive row after confirmation', async () => {
    deleteJobRow.mockResolvedValue(undefined);

    render(<VideoExportJobsPanel />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Supprimer' })[0]!);
    const deleteButtons = screen.getAllByRole('button', {
      name: 'Supprimer',
    });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]!);

    await waitFor(() =>
      expect(deleteJobRow).toHaveBeenCalledWith(expect.any(String))
    );
    expect(toastSuccess).toHaveBeenCalledWith('Ligne supprimée');
  });

  it('uses the API delete permission instead of inferring from cancel state', async () => {
    deleteJobRow.mockResolvedValue(undefined);
    jobs.splice(0, jobs.length, {
      job_id: 'job-running-manual',
      flight_name: 'Export manuel en cours',
      flight_title: 'Export manuel en cours',
      status: 'processing',
      internal_status: 'capturing',
      progress: 12,
      message: 'Capturing frames',
      mode: 'manual_fast',
      can_cancel: true,
      can_delete: true,
    });

    render(<VideoExportJobsPanel />);
    const deleteButtons = screen.getAllByRole('button', {
      name: 'Supprimer',
    });
    fireEvent.click(deleteButtons[0]!);
    const confirmButtons = screen.getAllByRole('button', { name: 'Supprimer' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() =>
      expect(deleteJobRow).toHaveBeenCalledWith('job-running-manual')
    );
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
