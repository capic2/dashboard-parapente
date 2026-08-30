import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FlightGenerationLogsPanel } from './FlightGenerationLogsPanel';

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
});
