import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { getStaleTime } from '../../lib/cacheConfig';
import {
  type Flight,
  VIDEO_EXPORT_IN_PROGRESS_STATUSES,
} from '@dashboard-parapente/shared-types';

const isExportInProgress = (status?: string | null) =>
  status ? VIDEO_EXPORT_IN_PROGRESS_STATUSES.has(status) : false;

type ExportViewerAccess = {
  exportJobId?: string | null;
  exportToken?: string | null;
};

/**
 * Fetch flight details including video export status
 */
export const useFlight = (
  flightId: string,
  access: ExportViewerAccess = {}
) => {
  const hasExportAccess = Boolean(access.exportJobId && access.exportToken);

  return useQuery<Flight>({
    queryKey: [
      'flights',
      flightId,
      hasExportAccess ? 'export-viewer' : 'user',
      access.exportJobId ?? null,
    ],
    queryFn: async () => {
      if (hasExportAccess) {
        return await api
          .get(`export-viewer/jobs/${access.exportJobId}/flight`, {
            searchParams: { access_token: access.exportToken ?? '' },
          })
          .json();
      }
      return await api.get(`flights/${flightId}`).json();
    },
    enabled: !!flightId,
    staleTime: getStaleTime(1000 * 10), // 10 seconds - refresh frequently to check video status
    refetchInterval: (query) => {
      // Auto-refresh every 10 seconds if video is processing
      const data = query.state.data as Flight | undefined;
      return isExportInProgress(data?.video_export_status) ? 10000 : false;
    },
  });
};
