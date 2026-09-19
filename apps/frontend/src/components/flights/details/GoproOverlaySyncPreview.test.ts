import { describe, expect, it } from 'vitest';
import {
  manualOffsetForGpxStartAtVideoTime,
  sourceTimeAtPreviewTime,
} from './GoproOverlaySyncPreview';

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
