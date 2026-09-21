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
});
