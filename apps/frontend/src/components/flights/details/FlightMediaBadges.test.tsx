import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Flight } from '../../../types';

vi.mock('@dashboard-parapente/design-system', () => ({
  Button: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'flights.mediaFilesTitle': 'Available files',
        'flights.mediaFilesDescription': 'Flight media',
        'flights.gpxUnavailable': 'No GPX available',
        'flights.gpxBadge': 'GPX',
        'flights.temporarySourcesTitle': 'Temporary sources to publish',
        'flights.videoBadge': 'Video',
        'flights.videoNotGenerated': 'Not generated',
      })[key] ?? key,
  }),
}));

vi.mock('../video-export/FlightVideoExportControls', () => ({
  FlightVideoExportControls: () => null,
}));

vi.mock('./FlightMediaThumbnail', () => ({
  FlightMediaThumbnail: () => null,
}));

vi.mock('./FlightGpxThumbnail', () => ({
  FlightGpxThumbnail: () => null,
}));

vi.mock('./FlightYoutubeUploadControls', () => ({
  FlightYoutubeUploadControls: () => null,
}));

vi.mock('./FlightTemporaryMediaCard', () => ({
  FlightTemporaryMediaCard: ({
    sourceType,
  }: {
    sourceType: 'camera' | 'pano' | 'face' | 'pilote';
  }) => <div data-testid={`temporary-${sourceType}`} />,
}));

import { FlightMediaBadges } from './FlightMediaBadges';

const flight = { id: 'flight-1' } as Flight;

function renderMedia(
  hasPanoVideo: boolean,
  hasFaceVideo: boolean,
  hasPiloteVideo: boolean,
  hasGoproCameraVideo = false
) {
  return render(
    <FlightMediaBadges
      flightId="flight-1"
      hasGpx={false}
      hasVideo={false}
      hasYoutubeVideoOnYoutube={false}
      hasPanoVideo={hasPanoVideo}
      hasGoproCameraVideo={hasGoproCameraVideo}
      hasFaceVideo={hasFaceVideo}
      hasPiloteVideo={hasPiloteVideo}
      flight={flight}
      hasPersistedGoproOverlay={false}
      hasCompletedGoproOverlayJob={false}
      isVideoExportRunning={false}
      isVideoExportFailed={false}
      isDownloadingAnyMedia={false}
      videoProcessingLabel="Video processing"
      onDownloadGpx={vi.fn()}
      onUploadGpx={vi.fn()}
      onDownloadVideo={vi.fn()}
      onDownloadPersistedGoproOverlay={vi.fn()}
    >
      <div />
    </FlightMediaBadges>
  );
}

describe('FlightMediaBadges temporary sources', () => {
  it('keeps the GoPro camera and lists available pano, face and pilote sources', () => {
    renderMedia(true, true, true, true);

    expect(
      screen.getByRole('heading', { name: 'Temporary sources to publish' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('temporary-pano')).toBeInTheDocument();
    expect(screen.getByTestId('temporary-face')).toBeInTheDocument();
    expect(screen.getByTestId('temporary-pilote')).toBeInTheDocument();
    expect(screen.getByTestId('temporary-camera')).toBeInTheDocument();
  });

  it('hides the temporary sources section when neither file is available', () => {
    renderMedia(false, false, false);

    expect(
      screen.queryByRole('heading', { name: 'Temporary sources to publish' })
    ).not.toBeInTheDocument();
  });
});
