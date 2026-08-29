// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoExportJob } from '../../../hooks/flights/useVideoExportJobs';
import { VideoExportJobsPanel } from './VideoExportJobsPanel';

const {
  cancelJob,
  cancelHighlightJob,
  cleanupTempFiles,
  deleteJobRow,
  deleteHighlightJob,
  restartJob,
  resumeJob,
  toastError,
  toastSuccess,
  refetch,
  jobs,
  typeCounts,
} = vi.hoisted(() => ({
  cancelJob: vi.fn(),
  cancelHighlightJob: vi.fn(),
  cleanupTempFiles: vi.fn(),
  deleteJobRow: vi.fn(),
  deleteHighlightJob: vi.fn(),
  restartJob: vi.fn(),
  resumeJob: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  refetch: vi.fn(),
  typeCounts: { all: 0 },
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
      fps: 30,
      log_tail: ['Opening viewer', 'Captured 10/100 frames'],
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
      log_tail: ['Starting overlay', 'Rendering overlay: 50%'],
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
  ] as VideoExportJob[],
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

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({
    error: toastError,
    success: toastSuccess,
  }),
}));

vi.mock('../../../hooks/flights/useVideoExportJobs', () => ({
  VIDEO_EXPORT_JOBS_PAGE_SIZE: 25,
  useVideoExportJobs: () => ({
    data: {
      jobs,
      page: 1,
      pageSize: 25,
      total: jobs.length,
      totalPages: 1,
      typeCounts,
    },
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
  useRestartVideoExportJob: () => ({
    mutateAsync: restartJob,
    isPending: false,
  }),
  useDeleteVideoExportJobRow: () => ({
    mutateAsync: deleteJobRow,
    isPending: false,
  }),
  useDeleteVideoExportOutput: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCleanupVideoExportTempFiles: () => ({
    mutateAsync: cleanupTempFiles,
    isPending: false,
  }),
  useVideoExportGpuStatus: () => ({
    data: {
      available: true,
      devices: [
        {
          name: 'NVIDIA test GPU',
          utilization_percent: 42,
          memory_used_mb: 1234,
          memory_total_mb: 24576,
        },
      ],
    },
    isLoading: false,
  }),
}));

vi.mock('../../../hooks/flights/useVideoExportStatus', () => ({
  useVideoExportStatus: (jobId?: string | null, enabled?: boolean) => ({
    status:
      enabled && jobId
        ? {
            job_id: jobId,
            status: 'processing',
            log_tail: ['Opening viewer', `${jobId} Captured 20/100 frames`],
          }
        : null,
    isConnected: Boolean(enabled && jobId),
  }),
}));

vi.mock('../../../hooks/flights/useYoutubeUpload', () => ({
  useCancelYoutubeUpload: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('../../../hooks/flights/useHighlightVideos', () => ({
  useCancelFlightHighlightVideo: () => ({
    mutateAsync: cancelHighlightJob,
    isPending: false,
  }),
  useDeleteFlightHighlightVideo: () => ({
    mutateAsync: deleteHighlightJob,
    isPending: false,
  }),
}));

vi.mock('../../../hooks/gopro/useGoproOverlay', () => ({
  useGoproOverlayJobStream: (
    jobId?: string | null,
    _token?: string | null,
    enabled?: boolean
  ) => ({
    job:
      enabled && jobId
        ? {
            job_id: jobId,
            status: 'running',
            progress: 50,
            message: 'Rendering overlay',
            log_tail: ['Starting overlay', 'Rendering overlay: 60%'],
          }
        : null,
    isConnected: Boolean(enabled && jobId),
  }),
}));

describe('VideoExportJobsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    typeCounts.all = 0;
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
        render_method: 'gpu',
        fps_actual: 12.4,
        log_tail: ['Opening viewer', 'Captured 10/100 frames'],
        can_cancel: true,
        can_delete: true,
      },
      {
        job_id: 'job-done',
        flight_title: 'Vol terminé',
        status: 'completed',
        internal_status: 'completed',
        progress: 100,
        fps: 30,
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
        render_method: 'cpu',
        log_tail: ['Starting overlay', 'Rendering overlay: 50%'],
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
        job_id: 'job-queued',
        flight_title: 'Vol en attente',
        status: 'queued',
        progress: 0,
        fps: 15,
        can_cancel: true,
        can_delete: true,
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
    expect(screen.getAllByText('GPU').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CPU').length).toBeGreaterThan(0);
    expect(screen.getAllByText('42%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('12.4 fps').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0.0 fps').length).toBeGreaterThan(0);
    expect(screen.queryByText('30.0 fps')).not.toBeInTheDocument();
    expect(screen.getAllByText('En cours').length).toBeGreaterThan(1);
    expect(
      screen.getAllByRole('button', { name: 'Actions' }).length
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Actions' })[0]!);
    expect(
      screen.getByRole('menuitem', { name: 'Stopper' })
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Logs' })).toBeInTheDocument();
  });

  it('uses the FPS from the last log line when it is available', () => {
    jobs[0] = {
      ...jobs[0],
      fps_actual: 12.4,
      log_tail: [
        'Opening viewer',
        '2026-08-27T18:15:22Z Captured 910/45525 frames (1.1 fps, ETA: 679min)',
      ],
    };

    render(<VideoExportJobsPanel />);

    expect(screen.getAllByText('1.1 fps').length).toBeGreaterThan(0);
    expect(screen.getAllByText('679 min').length).toBeGreaterThan(0);
    expect(screen.queryByText('12.4 fps')).not.toBeInTheDocument();
  });

  it('shows a stuck warning when an active job has not updated recently', () => {
    jobs.push({
      job_id: 'job-stuck',
      flight_title: 'Vol bloqué',
      status: 'processing',
      internal_status: 'capturing',
      progress: 0,
      updated_at: '2020-01-01T00:00:00.000Z',
      can_cancel: true,
      can_delete: true,
    });

    render(<VideoExportJobsPanel limit={null} />);

    expect(screen.getAllByText('En cours').length).toBeGreaterThan(1);
    expect(screen.queryByText('Bloqué')).not.toBeInTheDocument();
    expect(
      screen.getAllByText(
        /Aucune progression depuis .* Le traitement semble bloqué/u
      ).length
    ).toBeGreaterThan(0);
  });

  it('opens live logs in a readable modal on demand', () => {
    render(<VideoExportJobsPanel />);

    expect(screen.queryByText('Opening viewer')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Actions' })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Logs' }));

    expect(
      screen.getAllByText(/Captured 20\/100 frames/u).length
    ).toBeGreaterThan(0);
  });

  it('shows logs for the selected job', () => {
    render(<VideoExportJobsPanel />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Actions' })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Logs' }));

    expect(
      screen.getAllByText(/job-active Captured 20\/100 frames/u).length
    ).toBeGreaterThan(0);

    expect(
      screen.getAllByText(/job-active Captured 20\/100 frames/u).length
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
    fireEvent.click(screen.getAllByRole('button', { name: 'Actions' })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Stopper' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stopper' }));

    await waitFor(() => expect(cancelJob).toHaveBeenCalledWith('job-active'));
    expect(toastSuccess).toHaveBeenCalledWith('Génération stoppée');
  });

  it('uses the highlight endpoints for best-moments actions', async () => {
    cancelHighlightJob.mockResolvedValue(undefined);
    deleteHighlightJob.mockResolvedValue(undefined);
    jobs.push(
      {
        job_id: 'job-highlight-running',
        flight_id: 'flight-highlight',
        flight_title: 'Vol meilleurs moments',
        status: 'running',
        mode: 'highlight',
        can_cancel: true,
        can_delete: false,
      },
      {
        job_id: 'job-highlight-done',
        flight_id: 'flight-highlight',
        flight_title: 'Vol meilleurs moments terminé',
        status: 'completed',
        mode: 'highlight',
        has_output_file: true,
        can_cancel: false,
        can_delete: true,
      }
    );

    render(<VideoExportJobsPanel limit={null} />);
    const actions = screen.getAllByRole('button', { name: 'Actions' });
    fireEvent.click(actions[actions.length - 2]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Stopper' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stopper' }));

    await waitFor(() =>
      expect(cancelHighlightJob).toHaveBeenCalledWith({
        targetFlightId: 'flight-highlight',
        jobId: 'job-highlight-running',
      })
    );

    fireEvent.click(actions[actions.length - 1]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Supprimer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

    await waitFor(() =>
      expect(deleteHighlightJob).toHaveBeenCalledWith({
        targetFlightId: 'flight-highlight',
        jobId: 'job-highlight-done',
      })
    );
  });

  it('resumes a cancelled export', async () => {
    resumeJob.mockResolvedValue(undefined);

    render(<VideoExportJobsPanel />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Actions' })[3]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Relancer' }));

    await waitFor(() =>
      expect(resumeJob).toHaveBeenCalledWith('job-resumable')
    );
    expect(toastSuccess).toHaveBeenCalledWith('Génération relancée');
  });

  it('restarts a cancelled export when no frames can be resumed', async () => {
    restartJob.mockResolvedValue(undefined);
    jobs[3] = {
      ...jobs[3],
      can_resume: false,
      mode: 'manual_fast',
    };

    render(<VideoExportJobsPanel />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Actions' })[3]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Redémarrer' }));

    await waitFor(() =>
      expect(restartJob).toHaveBeenCalledWith({
        flightId: 'flight-resumable',
        mode: 'manual_fast',
      })
    );
    expect(toastSuccess).toHaveBeenCalledWith('Génération redémarrée');
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
    fireEvent.click(screen.getAllByRole('button', { name: 'Actions' })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Supprimer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

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
      log_tail: ['Capturing frames'],
      can_cancel: true,
      can_delete: true,
    });

    render(<VideoExportJobsPanel />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Actions' })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Supprimer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

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

  it('keeps filters available when the selected filter has no matching jobs', () => {
    jobs.splice(0, jobs.length);
    typeCounts.all = 1;

    render(
      <VideoExportJobsPanel typeFilter="gopro" onTypeFilterChange={vi.fn()} />
    );

    expect(
      screen.getByRole('button', { name: /Tous les types/u })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Réinitialiser' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Aucune génération ne correspond à ce filtre.')
    ).toBeInTheDocument();
  });
});
