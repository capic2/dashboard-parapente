import { describe, expect, it } from 'vitest';

import { getReplayTrackTrailPositions } from './flightViewerTrackTrail';

describe('flightViewerTrackTrail', () => {
  it('keeps the full track while it is shorter than the trail window', () => {
    const positions = [1, 2, 3];

    expect(getReplayTrackTrailPositions(positions, 2, undefined, 5)).toEqual([
      1, 2, 3,
    ]);
  });

  it('drops old positions as the replay advances', () => {
    const positions = [1, 2, 3, 4, 5, 6];

    expect(getReplayTrackTrailPositions(positions, 5, undefined, 3)).toEqual([
      4, 5, 6,
    ]);
  });

  it('reserves one trail slot for the interpolated current position', () => {
    const positions = [1, 2, 3, 4, 5, 6];

    expect(getReplayTrackTrailPositions(positions, 5, 6.5, 3)).toEqual([
      5, 6, 6.5,
    ]);
  });
});
