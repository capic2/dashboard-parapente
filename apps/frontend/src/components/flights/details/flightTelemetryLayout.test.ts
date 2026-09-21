import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FLIGHT_TELEMETRY_LAYOUT,
  parseTelemetryLayoutXml,
  serializeTelemetryLayoutXml,
} from './flightTelemetryLayout';
import type { FlightTelemetryWidgetLayout } from './flightTelemetryLayout';
import { getTelemetryMetricValue } from './telemetryMetrics';
import type { FlightTelemetryData } from '../../../hooks/flights/useFlightTelemetry';

describe('flight telemetry layout XML', () => {
  it('round-trips normalized widget positions and metrics', () => {
    const layout: FlightTelemetryWidgetLayout[] =
      DEFAULT_FLIGHT_TELEMETRY_LAYOUT.map((widget, index) => ({
        ...widget,
        x: 0.1 + index / 10,
        metric: index === 0 ? 'power' : widget.metric,
      }));

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(
      layout.map((widget) => ({ ...widget, x: Number(widget.x.toFixed(4)) }))
    );
  });

  it('falls back to the default layout for malformed XML', () => {
    expect(parseTelemetryLayoutXml('<broken')).toEqual(
      DEFAULT_FLIGHT_TELEMETRY_LAYOUT
    );
  });

  it('round-trips an added telemetry field', () => {
    const layout: FlightTelemetryWidgetLayout[] = [
      ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT,
      {
        id: 'field-extra',
        type: 'widget',
        metric: 'heading',
        x: 0.4,
        y: 0.4,
        width: 0.16,
        height: 0.1,
        visible: true,
      },
    ];

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(layout);
  });

  it('round-trips icons and group membership', () => {
    const layout = [
      {
        ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT[0],
        groupId: 'flight-info',
      },
      {
        id: 'wind-icon',
        type: 'icon' as const,
        icon: 'wind' as const,
        x: 0.4,
        y: 0.4,
        width: 0.06,
        height: 0.06,
        visible: true,
        groupId: 'flight-info',
      },
    ];

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(layout);
  });

  it('round-trips text elements', () => {
    const layout = [
      {
        id: 'title',
        type: 'text' as const,
        name: 'Titre',
        content: 'Vol du matin',
        transparent: true,
        border: false,
        x: 0.2,
        y: 0.3,
        width: 0.3,
        height: 0.08,
        visible: true,
      },
    ];

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(layout);
  });

  it('round-trips a widget without its metric label', () => {
    const layout = [
      {
        ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT[0],
        showLabel: false,
      },
    ];

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(layout);
  });

  it('round-trips a widget font size', () => {
    const layout = [
      {
        ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT[0],
        fontSize: 48,
      },
    ];

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(layout);
  });

  it('round-trips widget click and long-press actions', () => {
    const layout = [
      {
        ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT[0],
        clickAction: 'none' as const,
        longPressAction: 'cycle_metric' as const,
      },
    ];

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(layout);
  });

  it('round-trips the global background image', () => {
    const layout = [
      {
        ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT[0],
      },
    ] as typeof DEFAULT_FLIGHT_TELEMETRY_LAYOUT & {
      backgroundImage?: string;
    };
    layout.backgroundImage = 'data:image/png;base64,ZmFrZQ==';

    const parsed = parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout));

    expect(parsed.backgroundImage).toBe(layout.backgroundImage);
  });

  it('round-trips a graphical speedometer widget', () => {
    const layout = [
      {
        ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT[0],
        variant: 'speedometer' as const,
        metric: 'speed' as const,
      },
    ];

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(layout);
  });

  it('evaluates the calculated fields used by the 3840 GoPro layout', () => {
    const data = {
      points: [
        {
          timestamp: 1_700_000_000,
          lat: 0,
          lon: 0,
          elevation: 1200,
          segment: 0,
          vario_ms: 1,
          heart_rate: 100,
        },
        {
          timestamp: 1_700_001_000,
          lat: 0,
          lon: 0,
          elevation: 1250,
          segment: 0,
          vario_ms: -2,
          heart_rate: 140,
        },
        {
          timestamp: 1_700_002_000,
          lat: 0,
          lon: 0,
          elevation: 1230,
          segment: 0,
          vario_ms: 0,
          heart_rate: 120,
        },
      ],
    } as FlightTelemetryData;
    const point = data.points[1];

    expect(getTelemetryMetricValue(point, data, 'start_altitude')).toEqual([
      1200,
      'm',
    ]);
    expect(getTelemetryMetricValue(point, data, 'altitude_min')).toEqual([
      1200,
      'm',
    ]);
    expect(getTelemetryMetricValue(point, data, 'altitude_max')).toEqual([
      1250,
      'm',
    ]);
    expect(getTelemetryMetricValue(point, data, 'total_gain')).toEqual([
      50,
      'm',
    ]);
    expect(getTelemetryMetricValue(point, data, 'total_loss')).toEqual([
      20,
      'm',
    ]);
    expect(getTelemetryMetricValue(point, data, 'vario_min')).toEqual([
      -2,
      'm/s',
    ]);
    expect(getTelemetryMetricValue(point, data, 'heart_rate_max')).toEqual([
      140,
      'bpm',
    ]);
  });
});
