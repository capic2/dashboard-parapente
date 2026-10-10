import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  getFinishedActiveFlightIds,
  mergeActiveMediaJobs,
  useActiveFlightMediaJobs,
  useFlightSummaries,
} from '../hooks/flights/useFlightSummaries';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Site } from '../types';
import type { FlightSummary } from '@dashboard-parapente/shared-types';
import { VIDEO_EXPORT_IN_PROGRESS_STATUSES } from '@dashboard-parapente/shared-types';
import type { RowSelectionState, SortingState } from '@tanstack/react-table';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import {
  Button as AriaButton,
  Input,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  TextField,
} from 'react-aria-components';
import {
  CheckSquare,
  Check,
  ChevronDown,
  FilePlus2,
  Mountain,
  Upload,
  Search,
  Trash2,
  X,
  RefreshCw,
  MoreHorizontal,
} from 'lucide-react';
import { IntervalsSyncModal } from '../components/flights/intervals-sync/IntervalsSyncModal';
import { CreateFlightModal } from '../components/flights/create-flight/CreateFlightModal';
import { CreateSiteModal } from '../components/flights/create-site/CreateSiteModal';
import { FlightsTable } from '../components/flights/table/FlightsTable';
import { FlightDetails } from '../components/flights/details/FlightDetails';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import { Modal, Button } from '@dashboard-parapente/design-system';
import { useToast } from '../hooks/useToast';
import { HTTPError } from 'ky';
import { api } from '../lib/api';
import { useIsMobile } from '../hooks/useIsMobile';
import { useFlight } from '../hooks/flights/useFlight';
import { isGoproOverlayInProgress } from '../lib/flightMediaState';
import { getFlightGpxProvider } from '../lib/flightGpxProvider';
import {
  normalizeFlightsSearch,
  serializeFlightsSearch,
  type FlightDetailsTab,
  type FlightsSearch,
  type FlightsRouteSearch,
} from '../routes/-flightSearch';

function FlightListSkeleton() {
  return (
    <div aria-busy="true" className="space-y-2">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-32 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700"
        />
      ))}
    </div>
  );
}

function FlightDetailSkeleton() {
  return (
    <div
      aria-busy="true"
      className="h-80 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700"
    />
  );
}

function FlightListError({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl bg-white p-8 text-center shadow-md dark:bg-gray-800">
      <p className="mb-4 text-gray-700 dark:text-gray-300">{message}</p>
      <Button onClick={onRetry}>{retryLabel}</Button>
    </div>
  );
}

function FlightSearchInput({
  initialQuery,
  onQueryChange,
}: {
  initialQuery: string;
  onQueryChange: (query: string) => void;
}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState(initialQuery);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query === initialQuery) return;
    const timeout = window.setTimeout(() => onQueryChange(query), 300);
    return () => window.clearTimeout(timeout);
  }, [initialQuery, onQueryChange, searchQuery]);

  return (
    <TextField
      value={searchQuery}
      onChange={setSearchQuery}
      aria-label={t('flights.searchPlaceholder')}
    >
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <Input
          maxLength={200}
          placeholder={t('flights.searchPlaceholder')}
          className="min-h-11 w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 lg:min-h-10 lg:py-1.5"
        />
      </div>
    </TextField>
  );
}

const FLIGHT_BADGE_FILTERS = [
  { id: 'gpx', label: 'flights.gpxBadge' },
  { id: 'gpxIcu', label: 'flights.gpxIcuBadge' },
  { id: 'gpxStrava', label: 'flights.gpxStravaBadge' },
  { id: 'gpxZepp', label: 'flights.gpxZeppBadge' },
  { id: 'gpxNoSync', label: 'flights.gpxNoSyncBadge' },
  { id: 'sportstracklive', label: 'flights.sportstrackliveBadge' },
  { id: 'video', label: 'flights.videoBadge' },
  { id: 'camera', label: 'flights.cameraBadge' },
  { id: 'pano', label: 'flights.panoBadge' },
  { id: 'face', label: 'flights.faceBadge' },
  { id: 'pilote', label: 'flights.piloteBadge' },
  { id: 'goproOverlay', label: 'flights.goproOverlayBadge' },
  { id: 'highlightVideo', label: 'flights.highlightVideoBadge' },
  { id: 'youtube', label: 'flights.youtubeBadge' },
  { id: 'youtubeOverlay', label: 'flights.youtubeOverlayFilter' },
  { id: 'youtubeCamera', label: 'flights.youtubeCameraFilter' },
  { id: 'youtubeVideo', label: 'flights.youtubeVideoFilter' },
  { id: 'youtubePano', label: 'flights.youtubePanoFilter' },
  { id: 'youtubeFace', label: 'flights.youtubeFaceFilter' },
  { id: 'youtubePilote', label: 'flights.youtubePiloteFilter' },
  { id: 'youtubeHighlight', label: 'flights.youtubeHighlightFilter' },
] as const;
const PRIMARY_FLIGHT_BADGE_FILTERS = FLIGHT_BADGE_FILTERS.filter(
  ({ id }) => id === 'gpx' || id === 'video'
);
const ADVANCED_FLIGHT_BADGE_FILTERS = FLIGHT_BADGE_FILTERS.filter(
  ({ id }) => id !== 'gpx' && id !== 'video'
);

type FlightBadgeFilter = (typeof FLIGHT_BADGE_FILTERS)[number]['id'];
type YoutubeVideoType = NonNullable<
  FlightSummary['youtube_video_types']
>[number];
type BadgeFilterSelection = {
  included: FlightBadgeFilter[];
  excluded: FlightBadgeFilter[];
};

function hasYoutubeVideoType(
  flight: FlightSummary,
  ...types: YoutubeVideoType[]
) {
  return types.some((type) => flight.youtube_video_types?.includes(type));
}

function flightHasBadgeFilter(
  flight: FlightSummary,
  filter: FlightBadgeFilter
) {
  switch (filter) {
    case 'gpx':
      return flight.has_gpx;
    case 'gpxIcu':
      return flight.has_gpx && getFlightGpxProvider(flight) === 'intervals_icu';
    case 'gpxStrava':
      return flight.has_gpx && getFlightGpxProvider(flight) === 'strava';
    case 'gpxZepp':
      return (
        flight.has_gpx &&
        ['external', 'zepp'].includes(getFlightGpxProvider(flight) ?? '')
      );
    case 'gpxNoSync':
      return flight.has_gpx && flight.gopro_overlay_gpx_offset == null;
    case 'sportstracklive':
      return (
        flight.sportstracklive_status === 'uploaded' &&
        flight.sportstracklive_track_id != null
      );
    case 'video':
      return (
        flight.has_video ||
        hasYoutubeVideoType(flight, 'video') ||
        (flight.video_export_status != null &&
          (VIDEO_EXPORT_IN_PROGRESS_STATUSES.has(flight.video_export_status) ||
            flight.video_export_status === 'failed'))
      );
    case 'camera':
      return flight.has_camera || hasYoutubeVideoType(flight, 'camera');
    case 'pano':
      return flight.has_pano_video || hasYoutubeVideoType(flight, 'pano');
    case 'face':
      return (
        flight.has_face_video === true || hasYoutubeVideoType(flight, 'face')
      );
    case 'pilote':
      return (
        flight.has_pilote_video === true ||
        hasYoutubeVideoType(flight, 'pilote')
      );
    case 'goproOverlay':
      return (
        flight.has_gopro_overlay ||
        hasYoutubeVideoType(flight, 'gopro_overlay', 'youtube_overlay') ||
        isGoproOverlayInProgress(flight.gopro_overlay_status) ||
        flight.gopro_overlay_status === 'failed'
      );
    case 'highlightVideo':
      return (
        flight.has_highlight_video ||
        hasYoutubeVideoType(flight, 'highlight') ||
        (flight.highlight_video_status != null &&
          (VIDEO_EXPORT_IN_PROGRESS_STATUSES.has(
            flight.highlight_video_status
          ) ||
            flight.highlight_video_status === 'failed'))
      );
    case 'youtube':
      return (
        flight.has_youtube_video ||
        (flight.youtube_video_types?.length ?? 0) > 0 ||
        flight.youtube_upload_status === 'queued' ||
        flight.youtube_upload_status === 'uploading' ||
        flight.youtube_upload_status === 'failed'
      );
    case 'youtubeOverlay':
      return hasYoutubeVideoType(flight, 'gopro_overlay', 'youtube_overlay');
    case 'youtubeCamera':
      return hasYoutubeVideoType(flight, 'camera');
    case 'youtubeVideo':
      return hasYoutubeVideoType(flight, 'video');
    case 'youtubePano':
      return hasYoutubeVideoType(flight, 'pano');
    case 'youtubeFace':
      return hasYoutubeVideoType(flight, 'face');
    case 'youtubePilote':
      return hasYoutubeVideoType(flight, 'pilote');
    case 'youtubeHighlight':
      return hasYoutubeVideoType(flight, 'highlight');
  }
}

export default function FlightHistory() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const routeSearch = useSearch({ strict: false }) as FlightsRouteSearch;
  const search = normalizeFlightsSearch(routeSearch);
  const summariesQuery = useFlightSummaries(search);
  const [selectedBadgeFilters, setSelectedBadgeFilters] =
    useState<BadgeFilterSelection>({ included: [], excluded: [] });
  const activeJobsQuery = useActiveFlightMediaJobs();
  const flights = useMemo(
    () =>
      mergeActiveMediaJobs(
        summariesQuery.data?.pages.flatMap((page) => page.flights) ?? [],
        activeJobsQuery.data ?? []
      ),
    [summariesQuery.data, activeJobsQuery.data]
  );
  const filteredFlights = useMemo(() => {
    const { included, excluded } = selectedBadgeFilters;
    if (included.length === 0 && excluded.length === 0) return flights;
    return flights.filter((flight) => {
      const matchesIncluded =
        included.length === 0 ||
        included.some((filter) => flightHasBadgeFilter(flight, filter));
      const matchesExcluded = excluded.every(
        (filter) => !flightHasBadgeFilter(flight, filter)
      );
      return matchesIncluded && matchesExcluded;
    });
  }, [flights, selectedBadgeFilters]);
  const activeBadgeFilterCount =
    selectedBadgeFilters.included.length + selectedBadgeFilters.excluded.length;
  const advancedBadgeFilterCount = ADVANCED_FLIGHT_BADGE_FILTERS.filter(
    ({ id }) =>
      selectedBadgeFilters.included.includes(id) ||
      selectedBadgeFilters.excluded.includes(id)
  ).length;
  const totalFlights = summariesQuery.data?.pages[0]?.total ?? 0;
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = summariesQuery;
  let flightCountLabel = t('flights.registered', { count: totalFlights });
  if (search.siteId) {
    flightCountLabel = t('flights.registeredForSite', { count: totalFlights });
  }
  if (activeBadgeFilterCount > 0) {
    flightCountLabel = t('flights.filteredFlightCount', {
      count: filteredFlights.length,
      total: totalFlights,
    });
  }

  useEffect(() => {
    if (activeBadgeFilterCount > 0 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [activeBadgeFilterCount, fetchNextPage, hasNextPage, isFetchingNextPage]);

  const isMobile = useIsMobile();

  const selectedFlightId = params.flightId ?? null;
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isTagFilterExpanded, setIsTagFilterExpanded] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [flightToDelete, setFlightToDelete] = useState<FlightSummary | null>(
    null
  );
  const [showMultiDeleteConfirm, setShowMultiDeleteConfirm] = useState(false);
  const [showIntervalsSyncModal, setShowIntervalsSyncModal] = useState(false);
  const [showCreateFlightModal, setShowCreateFlightModal] = useState(false);
  const [createFlightMode, setCreateFlightMode] = useState<'manual' | 'file'>(
    'file'
  );
  const [showCreateSiteModal, setShowCreateSiteModal] = useState(false);
  const showMobileDetail = Boolean(isMobile && selectedFlightId);
  const selectedFlightQuery = useFlight(selectedFlightId ?? '');
  const selectedFlight = selectedFlightQuery.data;
  const [isDeleting, setIsDeleting] = useState(false);
  const sitesQuery = useQuery(sitesQueryOptions());
  const sites = sitesQuery.data ?? [];
  const queryClient = useQueryClient();
  const toast = useToast();
  const previousActiveJobs = useRef(activeJobsQuery.data ?? []);

  const renderBadgeFilter = (filter: (typeof FLIGHT_BADGE_FILTERS)[number]) => {
    const isIncluded = selectedBadgeFilters.included.includes(filter.id);
    const isExcluded = selectedBadgeFilters.excluded.includes(filter.id);
    const isSelected = isIncluded || isExcluded;
    let stateClassName =
      'border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-950 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-slate-100';
    let accessibleStateKey = 'flights.tagNotSelected';
    if (isIncluded) {
      stateClassName =
        'border-sky-600 bg-sky-100 text-sky-950 dark:border-sky-400 dark:bg-sky-900 dark:text-sky-100';
      accessibleStateKey = 'flights.tagIncluded';
    } else if (isExcluded) {
      stateClassName =
        'border-rose-600 bg-rose-100 text-rose-950 dark:border-rose-400 dark:bg-rose-900 dark:text-rose-100';
      accessibleStateKey = 'flights.tagExcluded';
    }

    return (
      <button
        key={filter.id}
        type="button"
        aria-pressed={isSelected}
        aria-label={t(accessibleStateKey, { tag: t(filter.label) })}
        onClick={() => toggleBadgeFilter(filter.id)}
        className={`min-h-9 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 lg:min-h-8 lg:px-2.5 ${stateClassName}`}
      >
        {isIncluded && (
          <Check aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" />
        )}
        {isExcluded && (
          <span aria-hidden="true" className="mr-1 font-bold">
            −
          </span>
        )}
        {t(filter.label)}
      </button>
    );
  };

  const renderDetailPanel = (mobileMode: boolean) => {
    if (selectedFlightId && selectedFlight) {
      if (mobileMode) {
        return (
          <FlightDetails
            key={selectedFlightId}
            flight={selectedFlight}
            sites={sites}
            activeTab={routeSearch.tab ?? 'infos'}
            onActiveTabChange={handleActiveTabChange}
            onShowCreateSiteModal={() => setShowCreateSiteModal(true)}
            mobileMode
            onCloseMobile={handleCloseMobileDetail}
          />
        );
      }

      return (
        <FlightDetails
          key={selectedFlightId}
          flight={selectedFlight}
          sites={sites}
          activeTab={routeSearch.tab ?? 'infos'}
          onActiveTabChange={handleActiveTabChange}
          onShowCreateSiteModal={() => setShowCreateSiteModal(true)}
        />
      );
    }

    if (selectedFlightId && selectedFlightQuery.isPending) {
      return <FlightDetailSkeleton />;
    }

    if (selectedFlightId && selectedFlightQuery.isError) {
      return (
        <FlightListError
          message={t('flights.detailLoadError')}
          retryLabel={t('flights.retryDetail')}
          onRetry={() => void selectedFlightQuery.refetch()}
        />
      );
    }

    return (
      <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center dark:border-slate-700 dark:bg-gray-800 lg:min-h-full">
        <Mountain
          aria-hidden="true"
          className="mb-4 h-8 w-8 text-sky-700 dark:text-sky-300"
        />
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {t('flights.selectFlightTitle')}
        </h2>
        <p className="mt-2 max-w-sm text-sm text-gray-600 dark:text-gray-300">
          {t('flights.selectFlightHint')}
        </p>
      </div>
    );
  };

  const renderListPanel = () => {
    if (summariesQuery.isPending) {
      return <FlightListSkeleton />;
    }

    if (summariesQuery.isError) {
      return (
        <FlightListError
          message={t('flights.listLoadError')}
          retryLabel={t('flights.retryList')}
          onRetry={() => void summariesQuery.refetch()}
        />
      );
    }

    return (
      <FlightsTable
        flights={filteredFlights}
        selectedFlightId={selectedFlightId}
        selectionMode={selectionMode}
        onSelectFlight={handleSelectFlight}
        onDeleteFlight={setFlightToDelete}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        sorting={[{ id: search.sort, desc: search.order === 'desc' }]}
        onSortingChange={(updater) => {
          const current: SortingState = [
            { id: search.sort, desc: search.order === 'desc' },
          ];
          const next =
            typeof updater === 'function' ? updater(current) : updater;
          const first = next[0];
          if (!first) return;
          void navigateWithSearch({
            ...search,
            sort: first.id as FlightsSearch['sort'],
            order: first.desc ? 'desc' : 'asc',
          });
        }}
        hasMoreFlights={hasNextPage}
        isLoadingMore={isFetchingNextPage}
        desktopPaneLayout
        onLoadMore={() => void fetchNextPage()}
        emptyMessage={
          activeBadgeFilterCount > 0
            ? t('flights.noFlightsWithBadges')
            : t('flights.noFlights')
        }
      />
    );
  };

  useEffect(() => {
    if (!activeJobsQuery.data) return;
    const finishedFlightIds = getFinishedActiveFlightIds(
      previousActiveJobs.current,
      activeJobsQuery.data
    );
    previousActiveJobs.current = activeJobsQuery.data;
    if (finishedFlightIds.length === 0) return;
    void queryClient.invalidateQueries({
      queryKey: ['flights', 'summaries'],
    });
    for (const flightId of finishedFlightIds) {
      void queryClient.invalidateQueries({ queryKey: ['flights', flightId] });
    }
  }, [activeJobsQuery.data, queryClient]);

  const navigateWithSearch = useCallback(
    (nextSearch: FlightsSearch, flightId = selectedFlightId) => {
      if (flightId) {
        return navigate({
          to: '/flights/$flightId',
          params: { flightId },
          search: {
            ...serializeFlightsSearch(nextSearch),
            tab: routeSearch.tab,
          },
          replace: true,
        });
      }
      return navigate({
        to: '/flights',
        search: { ...serializeFlightsSearch(nextSearch), tab: routeSearch.tab },
        replace: true,
      });
    },
    [navigate, routeSearch.tab, selectedFlightId]
  );

  const handleActiveTabChange = useCallback(
    (tab: FlightDetailsTab) => {
      const nextSearch = {
        ...serializeFlightsSearch(search),
        tab: tab === 'infos' ? undefined : tab,
      };
      if (selectedFlightId) {
        void navigate({
          to: '/flights/$flightId',
          params: { flightId: selectedFlightId },
          search: nextSearch,
        });
        return;
      }
      void navigate({ to: '/flights', search: nextSearch });
    },
    [navigate, search, selectedFlightId]
  );

  const handleSearchQueryChange = (query: string) => {
    void navigateWithSearch({ ...search, q: query || undefined });
  };

  const setSelectedFlightId = useCallback(
    (flightId: string | undefined) => {
      if (flightId) {
        void navigate({
          to: '/flights/$flightId',
          params: { flightId },
          search: { ...serializeFlightsSearch(search), tab: routeSearch.tab },
        });
        return;
      }

      void navigate({
        to: '/flights',
        search: { ...serializeFlightsSearch(search), tab: routeSearch.tab },
      });
    },
    [navigate, routeSearch.tab, search]
  );

  const handleSelectFlight = useCallback(
    (flight: FlightSummary) => {
      setSelectedFlightId(flight.id);
    },
    [setSelectedFlightId]
  );

  const handleCloseMobileDetail = useCallback(() => {
    setSelectedFlightId(undefined);
  }, [setSelectedFlightId]);

  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
    setRowSelection({});
    setSelectedFlightId(undefined);
  }, [setSelectedFlightId]);

  const selectedFlightIds = Object.keys(rowSelection);
  const selectedCount = selectedFlightIds.length;

  const handleSelectAll = useCallback(() => {
    const allSelected: RowSelectionState = {};
    for (const flight of filteredFlights) {
      allSelected[flight.id] = true;
    }
    setRowSelection(allSelected);
  }, [filteredFlights]);

  const toggleBadgeFilter = (filter: FlightBadgeFilter) => {
    setSelectedBadgeFilters((current) => {
      if (current.included.includes(filter)) {
        return {
          included: current.included.filter((selected) => selected !== filter),
          excluded: [...current.excluded, filter],
        };
      }
      if (current.excluded.includes(filter)) {
        return {
          ...current,
          excluded: current.excluded.filter((selected) => selected !== filter),
        };
      }
      return { ...current, included: [...current.included, filter] };
    });
  };

  const handleDeselectAll = useCallback(() => {
    setRowSelection({});
  }, []);

  const handleSiteCreated = useCallback(
    (newSite: Site) => {
      setShowCreateSiteModal(false);
      toast.success(t('flights.siteCreatedSuccess', { name: newSite.name }));
    },
    [toast, t]
  );

  const handleDeleteFlight = useCallback(async () => {
    setIsDeleting(true);
    try {
      if (selectionMode && selectedCount > 0) {
        let successCount = 0;
        let failCount = 0;

        const deleteResults = await Promise.allSettled(
          selectedFlightIds.map((flightId) => api.delete(`flights/${flightId}`))
        );
        successCount = deleteResults.filter(
          (result) => result.status === 'fulfilled'
        ).length;
        failCount = deleteResults.length - successCount;

        queryClient.invalidateQueries({ queryKey: ['flights'] });
        queryClient.invalidateQueries({ queryKey: ['flights', 'stats'] });

        if (failCount === 0) {
          toast.success(t('flights.deleted', { count: successCount }));
        } else {
          toast.error(
            t('flights.deletePartial', {
              success: successCount,
              fail: failCount,
              count: failCount,
            })
          );
        }

        setRowSelection({});
        setShowMultiDeleteConfirm(false);
      } else if (flightToDelete) {
        await api.delete(`flights/${flightToDelete.id}`);
        queryClient.invalidateQueries({ queryKey: ['flights'] });
        queryClient.invalidateQueries({ queryKey: ['flights', 'stats'] });
        toast.success(t('flights.deletedSuccess'));
        if (selectedFlightId === flightToDelete.id) {
          setSelectedFlightId(undefined);
        }
        setFlightToDelete(null);
      }
    } catch (err) {
      toast.error(
        t(
          err instanceof HTTPError && err.response.status === 404
            ? 'flights.deleteNotFoundError'
            : 'flights.deleteError'
        )
      );
    } finally {
      setIsDeleting(false);
    }
  }, [
    flightToDelete,
    selectedFlightId,
    selectedFlightIds,
    selectedCount,
    selectionMode,
    setSelectedFlightId,
    toast,
    queryClient,
    t,
  ]);

  return (
    <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-950 dark:text-white">
            {t('flights.history')}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {flightCountLabel}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setCreateFlightMode('file');
              setShowCreateFlightModal(true);
            }}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 sm:flex-none"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            {t('flights.importFile')}
          </Button>
          <MenuTrigger>
            <AriaButton
              aria-label={t('flights.moreActions')}
              className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            </AriaButton>
            <Popover className="z-40 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-800">
              <Menu className="outline-none">
                <MenuItem
                  onAction={() => {
                    setCreateFlightMode('manual');
                    setShowCreateFlightModal(true);
                  }}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700"
                >
                  <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                  {t('flights.manualEntry')}
                </MenuItem>
                <MenuItem
                  onAction={() => setShowIntervalsSyncModal(true)}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  {t('flights.syncIntervals')}
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(22rem,26rem)_minmax(0,1fr)] lg:grid-rows-1">
        {/* Flight List */}
        {(!isMobile || !showMobileDetail) && (
          <aside className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/40 lg:flex lg:min-h-0 lg:flex-col lg:p-2.5">
            {!selectionMode ? (
              <div className="mb-3 space-y-2 border-b border-slate-200 pb-3 dark:border-slate-700 lg:mb-2 lg:space-y-1.5 lg:pb-2 lg:max-h-[55%] lg:shrink-0 lg:overflow-y-auto">
                <FlightSearchInput
                  key={search.q ?? ''}
                  initialQuery={search.q ?? ''}
                  onQueryChange={handleSearchQueryChange}
                />
                <fieldset className="min-w-0 space-y-2 lg:space-y-1">
                  <legend className="flex w-full items-center justify-between gap-2">
                    <button
                      type="button"
                      aria-expanded={isTagFilterExpanded}
                      aria-controls="flight-tag-filter-options"
                      aria-label={
                        activeBadgeFilterCount > 0
                          ? t('flights.tagFilterActive', {
                              count: activeBadgeFilterCount,
                            })
                          : undefined
                      }
                      onClick={() =>
                        setIsTagFilterExpanded((expanded) => !expanded)
                      }
                      className="flex min-h-9 min-w-0 items-center gap-2 text-left text-xs font-semibold text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-gray-300 lg:min-h-8"
                    >
                      {t('flights.tagFilter')}
                      {activeBadgeFilterCount > 0 && (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-sky-800 dark:bg-sky-900 dark:text-sky-100">
                          {activeBadgeFilterCount}
                        </span>
                      )}
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 transition-transform ${
                          isTagFilterExpanded ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                    <Button
                      variant="ghost"
                      onClick={handleToggleSelectionMode}
                      className="min-h-10 shrink-0 rounded-lg px-2 py-1 text-xs sm:text-sm lg:min-h-8"
                    >
                      <CheckSquare className="h-4 w-4" aria-hidden="true" />
                      {t('flights.select')}
                    </Button>
                  </legend>
                  <div
                    id="flight-tag-filter-options"
                    hidden={!isTagFilterExpanded}
                    className="space-y-2 lg:space-y-1"
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {PRIMARY_FLIGHT_BADGE_FILTERS.map(renderBadgeFilter)}
                    </div>
                    <details className="group rounded-lg">
                      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 rounded-md text-xs font-medium text-sky-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-sky-300 lg:min-h-8">
                        {advancedBadgeFilterCount > 0
                          ? t('flights.moreTagFiltersActive', {
                              count: advancedBadgeFilterCount,
                            })
                          : t('flights.moreTagFilters')}
                        <ChevronDown
                          aria-hidden="true"
                          className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
                        />
                      </summary>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {ADVANCED_FLIGHT_BADGE_FILTERS.map(renderBadgeFilter)}
                      </div>
                    </details>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('flights.tagFilterInstructions')}
                    </p>
                    {activeBadgeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedBadgeFilters({
                            included: [],
                            excluded: [],
                          })
                        }
                        className="min-h-9 rounded-md px-2 text-xs font-medium text-sky-700 underline underline-offset-2 hover:text-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-sky-300 dark:hover:text-sky-100"
                      >
                        {t('flights.clearTagFilters', {
                          count: activeBadgeFilterCount,
                        })}
                      </button>
                    )}
                  </div>
                </fieldset>
              </div>
            ) : (
              <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-800 dark:bg-sky-950/30 lg:max-h-[55%] lg:shrink-0 lg:overflow-y-auto">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-sky-900 dark:text-sky-100">
                    {t('flights.selected', { count: selectedCount })}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleToggleSelectionMode}
                    aria-label={t('flights.cancel')}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {t('flights.selectAll')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDeselectAll}
                  >
                    {t('flights.deselectAll')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowMultiDeleteConfirm(true)}
                    isDisabled={selectedCount === 0}
                    className="ml-auto"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {t('flights.deleteCount', { count: selectedCount })}
                  </Button>
                </div>
              </div>
            )}
            {renderListPanel()}
          </aside>
        )}

        {/* Detail Panel + 3D Viewer (desktop) */}
        {!isMobile && (
          <main className="min-h-0 min-w-0 space-y-4 overflow-y-auto pr-1">
            {renderDetailPanel(false)}
          </main>
        )}

        {/* Detail Panel + 3D Viewer (mobile) */}
        {isMobile && showMobileDetail ? (
          <div className="space-y-4">{renderDetailPanel(true)}</div>
        ) : null}
      </div>

      <IntervalsSyncModal
        isOpen={showIntervalsSyncModal}
        onClose={() => setShowIntervalsSyncModal(false)}
        onSyncComplete={() => {
          void queryClient.invalidateQueries({ queryKey: ['flights'] });
        }}
      />

      {/* Modal de création manuelle ou depuis un fichier de trace */}
      <CreateFlightModal
        isOpen={showCreateFlightModal}
        sites={sites}
        isSitesLoading={sitesQuery.isPending}
        hasSitesError={sitesQuery.isError}
        initialMode={createFlightMode}
        onClose={() => setShowCreateFlightModal(false)}
        onCreateComplete={() => {
          void queryClient.invalidateQueries({ queryKey: ['flights'] });
        }}
      />

      {/* Modal Créer un site */}
      <CreateSiteModal
        isOpen={showCreateSiteModal}
        onClose={() => setShowCreateSiteModal(false)}
        onSiteCreated={handleSiteCreated}
        flightId={selectedFlightId || undefined}
      />

      {/* Modal de confirmation suppression simple */}
      <Modal
        role="alertdialog"
        isOpen={flightToDelete !== null}
        onClose={() => setFlightToDelete(null)}
        title={t('flights.confirmDelete')}
        size="sm"
      >
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          <Trans
            i18nKey="flights.confirmDeleteSingleMessage"
            values={{
              title: flightToDelete?.title || t('flights.untitledFlight'),
            }}
            components={{
              title: (
                <span className="font-bold text-red-600 dark:text-red-400" />
              ),
            }}
          />
        </p>
        <div className="flex gap-3 justify-end">
          <Button
            initialFocus
            onClick={() => setFlightToDelete(null)}
            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-all"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDeleteFlight}
            isDisabled={isDeleting}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {isDeleting ? t('flights.deleting') : t('flights.deleteButton')}
          </Button>
        </div>
      </Modal>

      {/* Modal de confirmation suppression multiple */}
      <Modal
        role="alertdialog"
        isOpen={showMultiDeleteConfirm && selectedCount > 0}
        onClose={() => setShowMultiDeleteConfirm(false)}
        title={t('flights.confirmDelete')}
        size="sm"
      >
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          {t('flights.confirmDeleteMulti', { count: selectedCount })}
        </p>
        <div className="flex gap-3 justify-end">
          <Button
            initialFocus
            onClick={() => setShowMultiDeleteConfirm(false)}
            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-all"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDeleteFlight}
            isDisabled={isDeleting}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {isDeleting
              ? t('flights.deleting')
              : t('flights.deleteButtonCount', { count: selectedCount })}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
