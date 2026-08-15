import { describe, expect, it } from 'vitest';
import { sourceTimeAtPreviewTime } from './GoproOverlaySyncPreview';

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
