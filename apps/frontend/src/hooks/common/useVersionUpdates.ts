import { useEffect, useState } from 'react';
import type { AppVersionPayload } from './useAppVersion';
import { isVersionNewer } from '../../lib/version';

type VersionUpdateState = {
  latestVersion: string | null;
  releaseNotesUrl: string | null;
};

function sanitizeReleaseNotesUrl(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return value;
    }
    return null;
  } catch {
    if (value.startsWith('/') && !value.startsWith('//')) {
      return value;
    }
    return null;
  }
}

function isAppVersionPayload(value: unknown): value is AppVersionPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.version === 'string' &&
    typeof payload.build_date === 'string' &&
    typeof payload.build_number === 'number'
  );
}

function getReleaseNotesUrlFromCurrentVersion(
  releaseNotesUrl: string | null,
  currentVersion: string,
  latestVersion: string
): string | null {
  if (!releaseNotesUrl) {
    return null;
  }

  try {
    const parsed = new URL(releaseNotesUrl);
    const releaseTagPath = parsed.pathname.match(
      /^(.*)\/releases\/tag\/(.+)$/u
    );

    if (
      parsed.hostname !== 'github.com' ||
      !releaseTagPath ||
      decodeURIComponent(releaseTagPath[2]) !== `deploy/${latestVersion}`
    ) {
      return releaseNotesUrl;
    }

    parsed.pathname = `${releaseTagPath[1]}/compare/deploy/${currentVersion}...deploy/${latestVersion}`;
    return parsed.toString();
  } catch {
    return releaseNotesUrl;
  }
}

export function useVersionUpdates(
  currentVersion: string | null
): VersionUpdateState {
  const [state, setState] = useState<VersionUpdateState>({
    latestVersion: null,
    releaseNotesUrl: null,
  });

  useEffect(() => {
    setState({ latestVersion: null, releaseNotesUrl: null });

    if (!currentVersion || typeof window === 'undefined') {
      return;
    }

    const eventSource = new EventSource('/api/version/stream');

    const handleVersionEvent = (event: MessageEvent<string>) => {
      let parsed: unknown;

      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }

      if (!isAppVersionPayload(parsed)) {
        return;
      }

      const nextVersion = parsed.version;
      const nextReleaseNotesUrl = sanitizeReleaseNotesUrl(
        parsed.release_notes_url
      );
      const versionRangeUrl = getReleaseNotesUrlFromCurrentVersion(
        nextReleaseNotesUrl,
        currentVersion,
        nextVersion
      );

      setState((previous) => {
        if (!isVersionNewer(nextVersion, currentVersion)) {
          return previous;
        }

        if (
          previous.latestVersion &&
          !isVersionNewer(nextVersion, previous.latestVersion)
        ) {
          return previous;
        }

        return {
          latestVersion: nextVersion,
          releaseNotesUrl: versionRangeUrl,
        };
      });
    };

    eventSource.addEventListener('version', handleVersionEvent);

    return () => {
      eventSource.removeEventListener('version', handleVersionEvent);
      eventSource.close();
    };
  }, [currentVersion]);

  return state;
}
