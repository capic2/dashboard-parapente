import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { FlightDecisionResponse } from '@dashboard-parapente/shared-types';
import FlightDecisionCockpit from './FlightDecisionCockpit';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@dashboard-parapente/design-system', () => ({
  Button: ({ children, ...props }: ComponentProps<'button'>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

const createDecision = (siteId: string): FlightDecisionResponse => ({
  site: {
    id: siteId,
    name: `Site ${siteId}`,
    usage_type: 'takeoff',
    orientation: 'W',
  },
  objective: 'tranquille',
  timezone: 'Europe/Paris',
  day_index: 0,
  summary: {
    level: 'favorable',
    translation_key: 'decision-level',
    score_objectif: 82,
    title_key: `decision-title-${siteId}`,
    message_key: `decision-message-${siteId}`,
    message_params: {},
    main_risk_code: null,
    has_recommended_window: true,
  },
  best_window: {
    start_hour: 10,
    end_hour: 12,
    level: 'favorable',
    score_objectif: 82,
    min_score_objectif: 78,
    hours: [10, 11, 12],
    main_risk_codes: [],
    translation_key: 'window-level',
    summary_key: 'window-summary',
    summary_params: {},
  },
  least_unfavorable_window: null,
  hourly: [],
  risks: [],
  confidence: {
    level: 'high',
    score: 90,
    translation_key: 'confidence-high',
    source_count: 4,
    expected_source_count: 5,
    freshness: {
      cached_at: null,
      age_minutes: null,
      status: 'fresh',
    },
    diagnostics: [],
  },
  landing_safety: {
    status: 'not_configured',
    level: 'vigilance',
    translation_key: 'landing-not-configured',
    summary_key: 'landing-summary',
    summary_params: {},
    landings: [],
  },
  live_wind: {
    status: 'not_evaluated',
    influences_confidence: false,
    stations: [],
    diagnostics: [],
  },
  alternatives: [],
  cached_at: null,
});

describe('FlightDecisionCockpit', () => {
  it('does not display a decision for a previous selected site', () => {
    render(
      <FlightDecisionCockpit
        decision={createDecision('site-a')}
        expectedSiteId="site-b"
        objective="tranquille"
        onObjectiveChange={vi.fn()}
      />
    );

    expect(screen.getByText('common.loading')).toBeInTheDocument();
    expect(screen.queryByText('decision-title-site-a')).not.toBeInTheDocument();
    expect(
      screen.queryByText('decision-message-site-a')
    ).not.toBeInTheDocument();
  });

  it('displays the decision when it matches the selected site', () => {
    render(
      <FlightDecisionCockpit
        decision={createDecision('site-b')}
        expectedSiteId="site-b"
        objective="tranquille"
        onObjectiveChange={vi.fn()}
      />
    );

    expect(screen.getByText('decision-title-site-b')).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
  });
});
