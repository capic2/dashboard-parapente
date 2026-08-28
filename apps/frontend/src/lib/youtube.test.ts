import { describe, expect, it } from 'vitest';
import { getYoutubeEmbedUrl, getYoutubeVideoId } from './youtube';

describe('YouTube URL parsing', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ?t=10',
    'https://youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://youtube.com/live/dQw4w9WgXcQ',
  ])('extracts the video id from %s', (url) => {
    expect(getYoutubeVideoId(url)).toBe('dQw4w9WgXcQ');
  });

  it('rejects non-YouTube and malformed links', () => {
    expect(
      getYoutubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')
    ).toBeNull();
    expect(
      getYoutubeVideoId('https://youtube.com/watch?v=too-short')
    ).toBeNull();
  });

  it('uses the privacy-enhanced embed domain', () => {
    const embedUrl = new URL(
      getYoutubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ') ?? ''
    );

    expect(embedUrl.origin).toBe('https://www.youtube-nocookie.com');
    expect(embedUrl.pathname).toBe('/embed/dQw4w9WgXcQ');
    expect(embedUrl.searchParams.get('enablejsapi')).toBe('1');
    expect(embedUrl.searchParams.get('origin')).toBe(window.location.origin);
  });
});
