import { describe, expect, it } from 'vitest';
import {
  computeCursorTelemetryLabel,
  DEFAULT_VIEWER_UNITS,
  getViewerUnitsFromStorage,
  parseViewerUnits,
} from './flightViewerTelemetry';

describe('flightViewerTelemetry', () => {
  it('parses units from settings JSON', () => {
    const units = parseViewerUnits(
      JSON.stringify({ units: { altitude: 'ft', speed: 'mph' } })
    );

    expect(units).toEqual({ altitude: 'ft', speed: 'mph' });
  });

  it('falls back to default units for malformed settings JSON', () => {
    expect(parseViewerUnits('{bad json')).toEqual(DEFAULT_VIEWER_UNITS);
    expect(parseViewerUnits(null)).toEqual(DEFAULT_VIEWER_UNITS);
  });

  it('reads units from local storage adapter', () => {
    const storage = {
      getItem: () =>
        JSON.stringify({ units: { altitude: 'ft', speed: 'mph' } }),
    };

    expect(getViewerUnitsFromStorage(storage)).toEqual({
      altitude: 'ft',
      speed: 'mph',
    });
  });

  it('computes telemetry label with metric units', () => {
    const coordinates = [
      { lat: 0, lon: 0, elevation: 1000, timestamp: 0 },
      { lat: 0, lon: 0.008993216059, elevation: 1010, timestamp: 60000 },
    ];

    const label = computeCursorTelemetryLabel(
      1,
      coordinates,
      0,
      DEFAULT_VIEWER_UNITS
    );

    expect(label).toBe('1010 m\n60 km/h');
  });

  it('computes telemetry label with imperial units', () => {
    const coordinates = [
      { lat: 0, lon: 0, elevation: 1000, timestamp: 0 },
      { lat: 0, lon: 0.008993216059, elevation: 1010, timestamp: 60000 },
    ];

    const label = computeCursorTelemetryLabel(1, coordinates, 0, {
      altitude: 'ft',
      speed: 'mph',
    });

    expect(label).toBe('3313.6 ft\n37.3 mph');
  });

  it('updates label values when scrubbing index changes', () => {
    const coordinates = [
      { lat: 0, lon: 0, elevation: 900, timestamp: 0 },
      { lat: 0, lon: 0.008993216059, elevation: 1000, timestamp: 60000 },
    ];

    const startLabel = computeCursorTelemetryLabel(
      0,
      coordinates,
      0,
      DEFAULT_VIEWER_UNITS
    );
    const scrubbedLabel = computeCursorTelemetryLabel(
      1,
      coordinates,
      0,
      DEFAULT_VIEWER_UNITS
    );

    expect(startLabel).toBe('900 m\n0 km/h');
    expect(scrubbedLabel).toBe('1000 m\n60 km/h');
  });
});
