import { describe, expect, it } from 'vitest';
import {
  interpolateTelemetryAtVideoTime,
  type FlightTelemetryData,
} from './useFlightTelemetry';

const data: FlightTelemetryData = {
  source: 'gpx+osv',
  has_osv: true,
  start_time: null,
  end_time: null,
  duration_seconds: 10,
  points: [
    {
      timestamp: 1_000,
      lat: 46,
      lon: 6,
      elevation: 1000,
      segment: 0,
      speed_kmh: 20,
      vario_ms: 1,
      distance_km: 0,
    },
    {
      timestamp: 11_000,
      lat: 46.01,
      lon: 6.01,
      elevation: 1100,
      segment: 0,
      speed_kmh: 30,
      vario_ms: 2,
      distance_km: 1,
    },
  ],
};

describe('interpolateTelemetryAtVideoTime', () => {
  it('interpolates a GPX point at the video time and applies the offset', () => {
    const point = interpolateTelemetryAtVideoTime(data, 6, 1);

    expect(point?.elevation).toBe(1050);
    expect(point?.speed_kmh).toBe(25);
    expect(point?.lat).toBeCloseTo(46.005);
  });

  it('uses the nearest point outside the track time range', () => {
    expect(interpolateTelemetryAtVideoTime(data, -1, 0)?.elevation).toBe(1000);
    expect(interpolateTelemetryAtVideoTime(data, 12, 0)?.elevation).toBe(1100);
  });

  it('does not interpolate across GPX segments', () => {
    const segmented = {
      ...data,
      points: [
        data.points[0],
        { ...data.points[1], timestamp: 2_000, segment: 1 },
      ],
    };

    expect(interpolateTelemetryAtVideoTime(segmented, 1, 0)?.segment).toBe(1);
  });

  it('returns no telemetry during a GPX segment gap', () => {
    const segmented = {
      ...data,
      points: [
        data.points[0],
        { ...data.points[1], timestamp: 10_000, segment: 1 },
      ],
    };

    expect(interpolateTelemetryAtVideoTime(segmented, 5, 0)).toBeNull();
    expect(interpolateTelemetryAtVideoTime(segmented, 9, 0)?.segment).toBe(1);
  });

  it('interpolates headings across north without taking the long turn', () => {
    const headingData = {
      ...data,
      points: [
        { ...data.points[0], heading_deg: 359 },
        { ...data.points[1], timestamp: 2_000, heading_deg: 1 },
      ],
    };

    expect(
      interpolateTelemetryAtVideoTime(headingData, 0.5, 0)?.heading_deg
    ).toBe(0);
  });

  it('returns no telemetry for an invalid time offset', () => {
    expect(interpolateTelemetryAtVideoTime(data, 0, Number.NaN)).toBeNull();
  });
});
