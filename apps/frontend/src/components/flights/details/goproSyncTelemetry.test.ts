import { describe, expect, it } from 'vitest';
import { telemetryAtTimestamp } from './goproSyncTelemetry';

describe('telemetryAtTimestamp', () => {
  const coordinates = [
    { lat: 45, lon: 5, elevation: 1000, timestamp: 1_000 },
    { lat: 45.001, lon: 5.002, elevation: 1100, timestamp: 11_000 },
  ];

  it('interpolates the GPX point at the requested timestamp', () => {
    const telemetry = telemetryAtTimestamp(coordinates, 6_000);

    expect(telemetry?.lat).toBeCloseTo(45.0005);
    expect(telemetry?.lon).toBeCloseTo(5.001);
    expect(telemetry?.elevation).toBe(1050);
    expect(telemetry?.timestamp).toBe(6_000);
    expect(telemetry?.speedKmh).toBeGreaterThan(0);
  });

  it('returns null outside the GPX timeline', () => {
    expect(telemetryAtTimestamp(coordinates, 999)).toBeNull();
    expect(telemetryAtTimestamp(coordinates, 11_001)).toBeNull();
  });
});
