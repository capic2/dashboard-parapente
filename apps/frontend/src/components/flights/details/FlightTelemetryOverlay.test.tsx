import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FlightTelemetryData } from '../../../hooks/flights/useFlightTelemetry';
import type { FlightTelemetryLayoutItem } from './flightTelemetryLayout';
import { FlightTelemetryOverlay } from './FlightTelemetryOverlay';
import { getTelemetryMetricValue } from './telemetryMetrics';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const telemetry: FlightTelemetryData = {
  points: [
    {
      timestamp: 1_000,
      lat: 45,
      lon: 6,
      elevation: 1_234,
      segment: 0,
      speed_kmh: 42.5,
      vario_ms: 1.2,
      distance_km: 3.4,
    },
  ],
  source: 'gpx',
  has_osv: false,
  enrichment_status: 'ready',
  start_time: null,
  end_time: null,
  duration_seconds: 0,
};

describe('FlightTelemetryOverlay', () => {
  it('renders every configured widget with the interpolated values', () => {
    render(
      <FlightTelemetryOverlay
        data={telemetry}
        videoTimeSeconds={0}
        offsetSeconds={0}
      />
    );

    expect(screen.getByText('1234')).toBeInTheDocument();
    expect(screen.getByText('42.5')).toBeInTheDocument();
    expect(screen.getByText('1.2')).toBeInTheDocument();
    expect(screen.getByText('3.4')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(7);
  });

  it('cycles only the clicked widget to the next metric', () => {
    render(
      <FlightTelemetryOverlay
        data={telemetry}
        videoTimeSeconds={0}
        offsetSeconds={0}
        layout={[
          {
            id: 'cycle-widget',
            type: 'widget',
            metric: 'altitude',
            x: 0,
            y: 0,
            width: 384,
            height: 216,
            visible: true,
            clickAction: 'cycle_metric',
          },
          {
            id: 'speed-widget',
            type: 'widget',
            metric: 'speed',
            x: 384,
            y: 0,
            width: 384,
            height: 216,
            visible: true,
          },
        ]}
      />
    );

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(screen.getAllByText('42.5')).toHaveLength(2);
    expect(
      screen.queryByText('flights.telemetrySpeed')
    ).not.toBeInTheDocument();
  });

  it('keeps transparent widgets free of visual layers', () => {
    const layout: FlightTelemetryLayoutItem[] = [
      {
        id: 'transparent-widget',
        type: 'widget',
        metric: 'altitude',
        x: 0,
        y: 0,
        width: 384,
        height: 216,
        visible: true,
        transparent: true,
      },
    ];

    render(
      <FlightTelemetryOverlay
        data={telemetry}
        videoTimeSeconds={0}
        offsetSeconds={0}
        layout={layout}
      />
    );

    const widget = screen.getByRole('button');
    expect(widget).toHaveClass('bg-transparent');
    expect(widget).not.toHaveClass('backdrop-blur-sm');
    expect(widget).not.toHaveClass('hover:bg-slate-900');
    expect(widget).not.toHaveClass('shadow-lg');
  });

  it('does not make a widget interactive when no action is configured', () => {
    render(
      <FlightTelemetryOverlay
        data={telemetry}
        videoTimeSeconds={0}
        offsetSeconds={0}
        layout={[
          {
            id: 'static-widget',
            type: 'widget',
            metric: 'altitude',
            x: 0,
            y: 0,
            width: 384,
            height: 216,
            visible: true,
          },
        ]}
      />
    );

    const widget = screen.getByRole('button');
    fireEvent.click(widget);

    expect(widget).toHaveClass('cursor-default');
    expect(widget).toHaveAttribute('tabindex', '-1');
    expect(screen.getByText('1234')).toBeInTheDocument();
    expect(screen.queryByText('42.5')).not.toBeInTheDocument();
  });

  it('keeps omitted transparency transparent by default', () => {
    render(
      <FlightTelemetryOverlay
        data={telemetry}
        videoTimeSeconds={0}
        offsetSeconds={0}
        layout={[
          {
            id: 'default-widget',
            type: 'widget',
            metric: 'altitude',
            x: 0,
            y: 0,
            width: 384,
            height: 216,
            visible: true,
          },
        ]}
      />
    );

    const widget = screen.getByRole('button');
    expect(widget).toHaveClass('bg-transparent');
    expect(widget).not.toHaveClass('backdrop-blur-sm');
  });

  it('renders an opaque background only when the layout disables transparency', () => {
    render(
      <FlightTelemetryOverlay
        data={telemetry}
        videoTimeSeconds={0}
        offsetSeconds={0}
        layout={[
          {
            id: 'opaque-widget',
            type: 'widget',
            metric: 'altitude',
            x: 0,
            y: 0,
            width: 384,
            height: 216,
            visible: true,
            transparent: false,
          },
        ]}
      />
    );

    expect(screen.getByRole('button')).toHaveClass('backdrop-blur-sm');
  });
  it('does not render metric labels in the final overlay', () => {
    render(
      <FlightTelemetryOverlay
        data={telemetry}
        videoTimeSeconds={0}
        offsetSeconds={0}
      />
    );

    expect(
      screen.queryByText('flights.telemetryAltitude')
    ).not.toBeInTheDocument();
  });

  it('keeps aggregate metrics available before a point is interpolated', () => {
    expect(getTelemetryMetricValue(null, telemetry, 'total_loss')).toEqual([
      0,
      'm',
    ]);
    expect(
      getTelemetryMetricValue(null, { ...telemetry, points: [] }, 'vario_min')
    ).toEqual([null, 'm/s']);
  });
  it('does not render editor group decorations', () => {
    const layout: FlightTelemetryLayoutItem[] = [
      {
        id: 'grouped-widget',
        type: 'widget',
        metric: 'altitude',
        x: 0,
        y: 0,
        width: 384,
        height: 216,
        visible: true,
        groupId: 'flight-stats',
        groupName: 'Flight stats',
      },
    ];

    render(
      <FlightTelemetryOverlay
        data={telemetry}
        videoTimeSeconds={0}
        offsetSeconds={0}
        layout={layout}
      />
    );

    expect(screen.queryByText('Flight stats')).not.toBeInTheDocument();
  });
});
