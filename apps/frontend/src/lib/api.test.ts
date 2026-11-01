import { describe, expect, it } from 'vitest';
import { getApiErrorMessage, getApiUrlWithSearchParams } from './api';

describe('getApiUrlWithSearchParams', () => {
  it('appends non-empty search params to api urls', () => {
    const url = getApiUrlWithSearchParams('/emagram/screenshot/abc/source', {
      access_token: 'token-123',
    });

    expect(url).toContain(
      '/api/emagram/screenshot/abc/source?access_token=token-123'
    );
  });

  it('ignores empty search params', () => {
    const url = getApiUrlWithSearchParams('/emagram/screenshot/abc/source', {
      access_token: null,
      unused: undefined,
    });

    expect(url).toContain('/api/emagram/screenshot/abc/source');
    expect(url).not.toContain('access_token=');
  });
});

describe('getApiErrorMessage', () => {
  const youtubeConflict = {
    message: 'Deletion blocked by YouTube publication safety.',
    details: [
      'A YouTube upload is in progress',
      'Publish this source to YouTube before deleting its local file',
    ],
  };

  it('uses the localized message for a known YouTube deletion conflict', async () => {
    const error = Object.assign(new Error('Conflict'), {
      response: new Response(
        JSON.stringify({
          detail:
            'Publish this source to YouTube before deleting its local file',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      ),
    });

    await expect(
      getApiErrorMessage(error, 'Unable to delete local file', {
        409: youtubeConflict,
      })
    ).resolves.toBe('Deletion blocked by YouTube publication safety.');
  });

  it('preserves an unrelated API detail for another 409 conflict', async () => {
    const error = Object.assign(new Error('Conflict'), {
      response: new Response(
        JSON.stringify({ detail: 'Video is outside flight storage' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      ),
    });

    await expect(
      getApiErrorMessage(error, 'Unable to delete local file', {
        409: youtubeConflict,
      })
    ).resolves.toBe('Video is outside flight storage');
  });
});
