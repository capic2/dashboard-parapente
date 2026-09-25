import { describe, expect, it } from 'vitest';
import { sourceFromInput } from './useYoutubeUpload';

describe('sourceFromInput', () => {
  it.each(['camera', 'video', 'pano'] as const)(
    'preserves the %s source for the upload query key',
    (source_type) => {
      expect(
        sourceFromInput({
          source_type,
          title: 'Vol test',
          description: '',
          privacy_status: 'unlisted',
        })
      ).toEqual({ source_type });
    }
  );

  it('preserves the overlay job identifier', () => {
    expect(
      sourceFromInput({
        source_type: 'gopro_overlay',
        gopro_overlay_job_id: 'overlay-1',
        title: 'Vol test',
        description: '',
        privacy_status: 'unlisted',
      })
    ).toEqual({
      source_type: 'gopro_overlay',
      gopro_overlay_job_id: 'overlay-1',
    });
  });
});
