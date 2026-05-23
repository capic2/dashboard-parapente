import { describe, expect, it } from 'vitest';
import { getApiUrlWithSearchParams } from './api';

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
