import { describe, expect, it } from 'vitest';
import {
  calibrationTelemetryTimestampAtVideoTime,
  manualOffsetForGpxEndAtVideoTime,
  manualOffsetForGpxStartAtVideoTime,
  sourceTimeAtPreviewTime,
} from './GoproOverlaySyncPreview';
import { telemetryTimestampAtVideoTime } from './goproSyncTelemetry';

const segments = [
  {
    preview_start_seconds: 0,
    source_start_seconds: 0,
    duration_seconds: 180,
  },
  {
    preview_start_seconds: 180,
    source_start_seconds: 1020,
    duration_seconds: 180,
  },
];

describe('sourceTimeAtPreviewTime', () => {
  it('keeps preview time during the opening segment', () => {
    expect(sourceTimeAtPreviewTime(90, segments)).toBe(90);
  });

  it('maps the concatenated tail back to the GoPro source timeline', () => {
    expect(sourceTimeAtPreviewTime(180, segments)).toBe(1020);
    expect(sourceTimeAtPreviewTime(240, segments)).toBe(1080);
  });

  it('uses an identity mapping while the original video is the fallback', () => {
    expect(
      sourceTimeAtPreviewTime(900, [
        {
          preview_start_seconds: 0,
          source_start_seconds: 0,
          duration_seconds: 1200,
        },
      ])
    ).toBe(900);
  });
});

describe('telemetryTimestampAtVideoTime', () => {
  it('uses only the manual calibration offset', () => {
    expect(telemetryTimestampAtVideoTime(1_000_000, 37, 6.6)).toBe(1_030_400);
  });
});

describe('calibrationTelemetryTimestampAtVideoTime', () => {
  it('keeps calibration on the GPX timeline and applies both offsets', () => {
    expect(
      calibrationTelemetryTimestampAtVideoTime(1_000_000, 6.6, -3, 10.4)
    ).toBe(999_200);
  });

  it('uses the first coordinate timestamp when the GPX start metadata differs', () => {
    expect(
      calibrationTelemetryTimestampAtVideoTime(1_002_000, 7.4, -3, 10.4)
    ).toBe(1_002_000);
  });
});

describe('manualOffsetForGpxStartAtVideoTime', () => {
  // REGRESSION CONTRACT — do not weaken or change these calibration cases
  // without explicit user authorization. They must match the rendered overlay.
  it('aligns the first GPX point with the current source-video time', () => {
    expect(manualOffsetForGpxStartAtVideoTime(42.5, -156)).toBe(198.5);
  });

  it('advances the GPX track when the selected video instant precedes its automatic start', () => {
    expect(manualOffsetForGpxStartAtVideoTime(7.5, 10)).toBe(-2.5);
  });
});

describe('manualOffsetForGpxEndAtVideoTime', () => {
  it('aligns the last GPX point with the current source-video time', () => {
    expect(manualOffsetForGpxEndAtVideoTime(642.5, -156, 600)).toBe(198.5);
  });

  it('advances the GPX track when the selected video instant precedes its end', () => {
    expect(manualOffsetForGpxEndAtVideoTime(607.5, 10, 600)).toBe(-2.5);
  });
});
