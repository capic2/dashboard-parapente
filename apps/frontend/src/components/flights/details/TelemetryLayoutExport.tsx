import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { FlightTelemetryData } from '../../../hooks/flights/useFlightTelemetry';
import {
  parseTelemetryLayoutXml,
  type FlightTelemetryLayoutItem,
} from './flightTelemetryLayout';
import { FlightTelemetryOverlay } from './FlightTelemetryOverlay';
import { api } from '../../../lib/api';

declare global {
  interface Window {
    _telemetryExportReady?: boolean;
    _telemetryExportError?: string;
    _setTelemetryExportTime?: (time: number) => Promise<void>;
  }
}

interface TelemetryLayoutResponse {
  xml_content: string;
}

function getExportParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    jobId: params.get('jobId') ?? '',
    token: params.get('exportToken') ?? '',
    timelineStart: Number(params.get('timelineStart')),
    offset: Number(params.get('offset')),
  };
}

export function TelemetryLayoutExport() {
  const { jobId, token, timelineStart, offset } = getExportParams();
  const [videoTimeSeconds, setVideoTimeSeconds] = useState(0);
  const telemetry = useQuery({
    queryKey: ['telemetry-export', jobId],
    queryFn: () =>
      api
        .get(`export-viewer/jobs/${jobId}/telemetry`, {
          searchParams: { access_token: token },
        })
        .json<FlightTelemetryData>(),
    enabled: Boolean(jobId && token),
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.enrichment_status === 'pending' ? 2_000 : false,
  });
  const layout = useQuery({
    queryKey: ['telemetry-export-layout', jobId],
    queryFn: () =>
      api
        .get(`export-viewer/jobs/${jobId}/telemetry-layout`, {
          searchParams: { access_token: token },
        })
        .json<TelemetryLayoutResponse>()
        .then((response) => parseTelemetryLayoutXml(response.xml_content)),
    enabled: Boolean(jobId && token),
    retry: false,
  });

  useEffect(() => {
    window._telemetryExportReady = false;
    delete window._telemetryExportError;
    window._setTelemetryExportTime = (time: number) =>
      new Promise<void>((resolve) => {
        setVideoTimeSeconds(time);
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    if (telemetry.isError || layout.isError) {
      window._telemetryExportError =
        'Les données de télémétrie ou le layout sont indisponibles';
      return;
    }
    if (telemetry.data?.enrichment_status === 'failed') {
      window._telemetryExportError =
        'La télémétrie enrichie du vol est indisponible';
      return;
    }
    if (
      telemetry.data?.enrichment_status !== 'pending' &&
      telemetry.data &&
      !telemetry.data.points.length
    ) {
      window._telemetryExportError =
        'Le vol ne contient aucun point de télémétrie';
      return;
    }
    if (
      telemetry.data?.points.length &&
      telemetry.data.enrichment_status !== 'pending' &&
      layout.data
    ) {
      window._telemetryExportReady = true;
    }
    return () => {
      window._telemetryExportReady = false;
      delete window._setTelemetryExportTime;
    };
  }, [layout.data, layout.isError, telemetry.data, telemetry.isError]);

  if (!telemetry.data || !layout.data) {
    return <div className="h-screen w-screen bg-transparent" />;
  }

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-transparent"
      style={{ containerType: 'inline-size' }}
    >
      <FlightTelemetryOverlay
        data={telemetry.data}
        videoTimeSeconds={videoTimeSeconds}
        offsetSeconds={Number.isFinite(offset) ? offset : 0}
        timelineStartTimestamp={
          Number.isFinite(timelineStart) ? timelineStart : undefined
        }
        layout={layout.data as readonly FlightTelemetryLayoutItem[]}
      />
    </div>
  );
}
