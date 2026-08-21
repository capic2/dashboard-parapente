import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Flight } from '../../../types';
import { FlightEditForm } from './FlightEditForm';

const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const flight: Flight = {
  id: 'flight-1',
  title: 'Test flight',
  flight_date: '2026-03-15',
  youtube_urls: [youtubeUrl],
};
const youtubeAssociations = [
  {
    url: youtubeUrl,
    video_id: 'owned-video',
    can_delete_from_youtube: true,
  },
];

const getButton = (translatedName: RegExp, keyName: RegExp) =>
  screen.getByRole('button', {
    name: new RegExp(`${translatedName.source}|${keyName.source}`, 'u'),
  });

describe('FlightEditForm YouTube removals', () => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    onSubmit.mockReset();
    onSubmit.mockResolvedValue(undefined);
    onCancel.mockReset();
  });

  it('discards a queued removal when flight editing is cancelled', () => {
    render(
      <FlightEditForm
        flight={flight}
        sites={[]}
        youtubeAssociations={youtubeAssociations}
        onSubmit={onSubmit}
        onCancel={onCancel}
        onShowCreateSiteModal={() => undefined}
      />
    );

    fireEvent.click(
      getButton(/Remove YouTube link 1/u, /flights\.removeYoutubeVideo/u)
    );
    fireEvent.click(
      getButton(/Dissociate only/u, /flights\.youtubeRemovalDissociate/u)
    );
    fireEvent.click(getButton(/^Cancel$/u, /flights\.cancel/u));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('submits a persisted removal separately from final flight values', async () => {
    render(
      <FlightEditForm
        flight={flight}
        sites={[]}
        youtubeAssociations={youtubeAssociations}
        onSubmit={onSubmit}
        onCancel={onCancel}
        onShowCreateSiteModal={() => undefined}
      />
    );

    fireEvent.click(
      getButton(/Remove YouTube link 1/u, /flights\.removeYoutubeVideo/u)
    );
    fireEvent.click(
      getButton(
        /Delete permanently from YouTube/u,
        /flights\.youtubeRemovalDeletePermanently/u
      )
    );
    fireEvent.click(getButton(/^Save$/u, /flights\.saveButton/u));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({ youtube_urls: [] }),
        pendingYoutubeRemovals: [
          {
            url: youtubeUrl,
            videoId: 'owned-video',
            deleteFromYoutube: true,
          },
        ],
      })
    );
  });

  it('keeps persisted links read-only so removal cannot bypass confirmation', () => {
    render(
      <FlightEditForm
        flight={flight}
        sites={[]}
        youtubeAssociations={youtubeAssociations}
        onSubmit={onSubmit}
        onCancel={onCancel}
        onShowCreateSiteModal={() => undefined}
      />
    );

    expect(screen.getByDisplayValue(youtubeUrl)).toHaveAttribute('readonly');
  });
});
