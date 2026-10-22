import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FlightGenerationLogsPanel } from './FlightGenerationLogsPanel';

vi.mock('../video-export/VideoExportJobsPanel', () => ({
  YoutubeTelemetryExportDetails: ({ job }: { job: { job_id: string } }) => (
    <div data-testid="youtube-telemetry-export" data-job-id={job.job_id} />
  ),
}));

describe('FlightGenerationLogsPanel', () => {
  it('shows the highlight render method as a tag beside the treatment title', () => {
    render(
      <FlightGenerationLogsPanel
        videoStatus={null}
        goproOverlayJob={null}
        youtubeUploadJob={null}
        highlightVideo={{
          job_id: 'highlight-1',
          flight_id: 'flight-1',
          status: 'running',
          progress: 52,
          message: 'Rendu du clip 2/6',
          error: null,
          render_method: 'gpu',
          output_format: 'original',
          overlay_offset_seconds: 0,
          selection: [],
          created_at: '2026-08-30T14:00:00Z',
          updated_at: '2026-08-30T14:01:00Z',
          completed_at: null,
          log_tail: [],
        }}
      />
    );

    const treatment = screen.getByRole('button', {
      name: /flights\.generationLogs\.highlightVideoTitle/u,
    });
    expect(treatment).toHaveTextContent('flights.generationLogs.method.gpu');
    expect(treatment).toHaveTextContent(
      'flights.generationLogs.status.running'
    );
  });

  it('shows an indeterminate upload state and elapsed time for YouTube uploads', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T12:01:05Z'));

    render(
      <FlightGenerationLogsPanel
        videoStatus={null}
        goproOverlayJob={null}
        youtubeUploadJob={{
          job_id: 'youtube-upload-1',
          flight_id: 'flight-1',
          source_type: 'youtube_overlay',
          status: 'uploading',
          progress: 0,
          created_at: '2026-10-22T12:00:00Z',
          updated_at: '2026-10-22T12:01:00Z',
          log_tail: [],
        }}
        highlightVideo={null}
      />
    );

    expect(screen.getByRole('progressbar')).not.toHaveAttribute(
      'aria-valuenow'
    );
    expect(
      screen.getByText('flights.generationLogs.elapsed')
    ).toBeInTheDocument();
    expect(screen.getByText('1 min')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows telemetry export progress in its own section, separate from YouTube upload logs', () => {
    render(
      <FlightGenerationLogsPanel
        videoStatus={null}
        goproOverlayJob={null}
        youtubeTelemetryExportJobId="telemetry-export-1"
        youtubeTelemetryExportStatus="running"
        youtubeTelemetryExportProgress={42}
        youtubeUploadJob={{
          job_id: 'youtube-upload-1',
          flight_id: 'flight-1',
          source_type: 'youtube_overlay',
          status: 'preparing',
          progress: 18,
          created_at: '2026-10-22T12:00:00Z',
          updated_at: '2026-10-22T12:01:00Z',
          log_tail: [],
        }}
        highlightVideo={null}
      />
    );

    const exportSection = screen.getByRole('region', {
      name: 'flights.generationLogs.exportProgressSectionTitle',
    });
    expect(exportSection).toContainElement(
      screen.getByTestId('youtube-telemetry-export')
    );
    expect(screen.getByTestId('youtube-telemetry-export')).toHaveAttribute(
      'data-job-id',
      'telemetry-export-1'
    );
    expect(
      screen.queryByRole('button', {
        name: /flights\.generationLogs\.youtubeUploadTitle/u,
      })
    ).not.toBeInTheDocument();
  });
});
