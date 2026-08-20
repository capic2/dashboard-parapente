// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { JobLogViewer } from './JobLogViewer';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (key: string, values?: { count?: number }) =>
      ({
        'flights.generationLogs.activity': 'Journal d’activité',
        'flights.generationLogs.technicalDetails': 'Détails techniques',
        'flights.generationLogs.level.info': 'Information',
        'flights.generationLogs.level.success': 'Succès',
        'flights.generationLogs.level.warning': 'Attention',
        'flights.generationLogs.level.error': 'Erreur',
        'flights.generationLogs.lineCount': `${values?.count ?? 0} lignes`,
      })[key] ?? key,
  }),
}));

describe('JobLogViewer', () => {
  it('renders timestamped events as a readable activity journal', () => {
    render(
      <JobLogViewer
        logs={[
          '[2026-07-31T10:15:20+00:00] Video encoded successfully',
          '[2026-07-31T10:16:20+00:00] FFmpeg timeout while encoding',
        ]}
        emptyLabel="Aucun événement"
      />
    );

    expect(screen.getByLabelText('Journal d’activité')).toBeInTheDocument();
    expect(screen.getByText('Video encoded successfully')).toBeInTheDocument();
    expect(
      screen.getByText('FFmpeg timeout while encoding')
    ).toBeInTheDocument();
    expect(screen.getByText('Succès:')).toBeInTheDocument();
    expect(screen.getByText('Erreur:')).toBeInTheDocument();
    expect(screen.getByText('2026-07-31T10:15:20Z')).toHaveAttribute(
      'datetime',
      '2026-07-31T10:15:20Z'
    );
    expect(screen.getByText('2026-07-31T10:16:20Z')).toBeInTheDocument();
  });

  it('keeps events without a timestamp readable', () => {
    render(
      <JobLogViewer
        logs={['Legacy export event']}
        emptyLabel="Aucun événement"
      />
    );

    expect(screen.getAllByText('Legacy export event')).toHaveLength(2);
    expect(document.querySelector('time')).not.toBeInTheDocument();
  });

  it('keeps raw technical lines in a collapsed section', () => {
    render(
      <JobLogViewer
        logs={['[2026-07-31T10:15:20+00:00] Captured 10/100 frames']}
        emptyLabel="Aucun événement"
      />
    );

    const summary = screen.getByText('Détails techniques');
    const details = summary.closest('details');
    expect(details).not.toHaveAttribute('open');

    fireEvent.click(summary);

    expect(details).toHaveAttribute('open');
    expect(
      screen.getByText('[2026-07-31T10:15:20+00:00] Captured 10/100 frames')
    ).toBeInTheDocument();
  });

  it('shows an explicit empty state', () => {
    render(<JobLogViewer logs={[]} emptyLabel="Aucun événement reçu" />);

    expect(screen.getByText('Aucun événement reçu')).toBeInTheDocument();
    expect(screen.queryByText('Détails techniques')).not.toBeInTheDocument();
  });
});
