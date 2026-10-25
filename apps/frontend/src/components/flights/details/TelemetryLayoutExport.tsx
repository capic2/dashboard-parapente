import { useEffect, useMemo, useState } from 'react';
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
    _getTelemetryExportTimes?: (duration: number) => number[];
    _getTelemetryExportPips?: () => {
      slot_id: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[];
  }
}

interface TelemetryLayoutResponse {
  xml_content: string;
}

interface TelemetryExportPip {
  slot_id: string;
  source: string;
  youtube_url: string;
  offset_seconds: number;
}

function getExportParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    jobId: params.get('jobId') ?? '',
    token: params.get('exportToken') ?? '',
    timelineStart: Number(params.get('timelineStart')),
    offset: Number(params.get('offset')),
    pipExports: params.get('pipExports') ?? '[]',
  };
}

function parsePipExports(value: string): TelemetryExportPip[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as TelemetryExportPip[]) : [];
  } catch {
    return [];
  }
}

export function TelemetryLayoutExport() {
  const {
    jobId,
    token,
    timelineStart,
    offset,
    pipExports: rawPipExports,
  } = getExportParams();
  const pipExports = useMemo(
    () => parsePipExports(rawPipExports),
    [rawPipExports]
  );
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
  const missingPipSlotId = pipExports.find(
    (pip) =>
      !layout.data?.some(
        (slot) =>
          slot.type === 'pip' &&
          slot.visible &&
          slot.id === pip.slot_id &&
          slot.source === pip.source
      )
  )?.slot_id;

  useEffect(() => {
    window._telemetryExportReady = false;
    delete window._telemetryExportError;
    window._getTelemetryExportTimes = (duration: number) => {
      const points = telemetry.data?.points ?? [];
      const originSeconds = Number.isFinite(timelineStart)
        ? timelineStart / 1000
        : (points[0]?.timestamp ?? 0) / 1000;
      const sampleTimes = points
        .map((point) => point.timestamp / 1000 - originSeconds + offset)
        .filter(
          (time) => Number.isFinite(time) && time >= 0 && time <= duration
        );
      return [...new Set([0, ...sampleTimes, duration])].sort(
        (first, second) => first - second
      );
    };
    window._getTelemetryExportPips = () =>
      pipExports.flatMap((pip) => {
        const slot = layout.data?.find(
          (item) => item.type === 'pip' && item.id === pip.slot_id
        );
        return slot
          ? [
              {
                slot_id: pip.slot_id,
                x: slot.x,
                y: slot.y,
                width: slot.width,
                height: slot.height,
              },
            ]
          : [];
      });
    window._setTelemetryExportTime = async (time: number) => {
      setVideoTimeSeconds(time);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    };
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
      if (missingPipSlotId) {
        window._telemetryExportError = `Le layout ne contient pas le PiP sélectionné (${missingPipSlotId})`;
        return;
      }
      window._telemetryExportReady = true;
    }
    return () => {
      window._telemetryExportReady = false;
      delete window._setTelemetryExportTime;
      delete window._getTelemetryExportTimes;
      delete window._getTelemetryExportPips;
    };
  }, [
    layout.data,
    layout.isError,
    offset,
    pipExports,
    missingPipSlotId,
    telemetry.data,
    telemetry.isError,
    timelineStart,
  ]);

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
      {pipExports.map((pip) => {
        const pipSlot = layout.data.find(
          (slot) => slot.type === 'pip' && slot.id === pip.slot_id
        );
        if (!pipSlot) return null;
        return (
          <div
            key={pip.slot_id}
            className="pointer-events-none absolute z-10 rounded-lg border-2 border-white/80 shadow-lg"
            style={{
              left: `${(pipSlot.x / 1920) * 100}%`,
              top: `${(pipSlot.y / 1080) * 100}%`,
              width: `${(pipSlot.width / 1920) * 100}%`,
              height: `${(pipSlot.height / 1080) * 100}%`,
            }}
          />
        );
      })}
    </div>
  );
}
