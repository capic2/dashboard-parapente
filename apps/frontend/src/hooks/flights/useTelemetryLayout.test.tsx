import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_FLIGHT_TELEMETRY_LAYOUT,
  serializeTelemetryLayoutXml,
} from '../../components/flights/details/flightTelemetryLayout';
import {
  useSaveTelemetryLayout,
  useTelemetryLayout,
} from './useTelemetryLayout';

const { apiGet, apiPut } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: { get: apiGet, put: apiPut },
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useSaveTelemetryLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refreshes flight layouts that inherit the saved default layout', async () => {
    const updatedLayout = [
      ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT,
      {
        id: 'force-rose',
        type: 'widget' as const,
        metric: 'g_force' as const,
        variant: 'force_rose' as const,
        x: 100,
        y: 100,
        width: 345.6,
        height: 194.4,
        visible: true,
      },
    ];
    const initialXml = serializeTelemetryLayoutXml(
      DEFAULT_FLIGHT_TELEMETRY_LAYOUT
    );
    const updatedXml = serializeTelemetryLayoutXml(updatedLayout);
    apiGet.mockImplementation(() => {
      const xmlContent =
        apiGet.mock.calls.length === 1 ? initialXml : updatedXml;
      return {
        json: vi.fn().mockResolvedValue({
          id: null,
          scope: 'flight',
          flight_id: 'flight-1',
          xml_content: xmlContent,
          format_version: 1,
          is_override: false,
        }),
      };
    });
    apiPut.mockReturnValue({
      json: vi.fn().mockResolvedValue({
        id: 'default-layout',
        scope: 'default',
        flight_id: null,
        xml_content: updatedXml,
        format_version: 1,
        is_override: false,
      }),
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const wrapper = createWrapper(queryClient);
    const flightLayout = renderHook(() => useTelemetryLayout('flight-1'), {
      wrapper,
    });
    const saveDefaultLayout = renderHook(() => useSaveTelemetryLayout(), {
      wrapper,
    });

    await waitFor(() =>
      expect(flightLayout.result.current.isSuccess).toBe(true)
    );
    expect(
      flightLayout.result.current.data?.layout.some(
        (item) => item.type === 'widget' && item.variant === 'force_rose'
      )
    ).toBe(false);

    await act(async () => {
      await saveDefaultLayout.result.current.mutateAsync({
        layout: updatedLayout,
      });
    });

    await waitFor(() => {
      expect(
        flightLayout.result.current.data?.layout.some(
          (item) => item.type === 'widget' && item.variant === 'force_rose'
        )
      ).toBe(true);
    });
    expect(apiGet).toHaveBeenCalledTimes(2);
  });
});
