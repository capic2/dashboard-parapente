import { useEffect, useState } from 'react';
import type { AppVersionPayload } from './useAppVersion';
import { isVersionNewer } from '../../lib/version';

type VersionUpdateState = {
  latestVersion: string | null;
  releaseNotesUrl: string | null;
};

function isAppVersionPayload(value: unknown): value is AppVersionPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.version === 'string' &&
    typeof payload.build_date === 'string' &&
    typeof payload.build_number === 'number' &&
    (typeof payload.release_notes_url === 'string' ||
      payload.release_notes_url === null ||
      payload.release_notes_url === undefined)
  );
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
      const nextReleaseNotesUrl = parsed.release_notes_url ?? null;

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
          releaseNotesUrl: nextReleaseNotesUrl,
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
