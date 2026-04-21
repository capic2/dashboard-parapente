import { queryOptions } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type AppVersionPayload = {
  version: string;
  build_date: string;
  build_number: number;
  release_notes_url?: string | null;
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

export const appVersionQueryOptions = () =>
  queryOptions<AppVersionPayload | null>({
    queryKey: ['app-version'],
    staleTime: Infinity,
    retry: 0,
    queryFn: async () => {
      try {
        const data = await api.get('version').json();

        if (!isAppVersionPayload(data)) {
          throw new Error('Invalid version payload');
        }

        console.log(`[Dashboard Parapente] Version ${data.version}`);
        return data;
      } catch (error) {
        console.warn('[Dashboard Parapente] Version unknown', error);
        return null;
      }
    },
  });
