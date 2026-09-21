import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FLIGHT_TELEMETRY_LAYOUT,
  parseTelemetryLayoutXml,
  serializeTelemetryLayoutXml,
} from './flightTelemetryLayout';
import type { FlightTelemetryWidgetLayout } from './flightTelemetryLayout';

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
});
