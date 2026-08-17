const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/u;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export function getYoutubeVideoId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    let videoId: string | null = null;

    if (url.hostname === 'youtu.be' || url.hostname === 'www.youtu.be') {
      videoId = url.pathname.split('/').filter(Boolean)[0] ?? null;
    } else if (YOUTUBE_HOSTS.has(url.hostname)) {
      if (url.pathname.replace(/\/$/u, '') === '/watch') {
        videoId = url.searchParams.get('v');
      } else {
        const [kind, id] = url.pathname.split('/').filter(Boolean);
        if (kind && ['embed', 'shorts', 'live'].includes(kind)) {
          videoId = id ?? null;
        }
      }
    }

    return videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : null;
  } catch {
    return null;
  }
}

export function getYoutubeEmbedUrl(rawUrl: string): string | null {
  const videoId = getYoutubeVideoId(rawUrl);
  return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
}
