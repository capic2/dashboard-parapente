import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { useBestSpotAPI } from './useBestSpotAPI';
import { mockBestSpot } from '../../mocks/data/bestSpot';
import { expect, describe, it } from 'vitest';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useBestSpotAPI', () => {
  it('should fetch best spot for day 0 (today)', async () => {
    const { result } = renderHook(() => useBestSpotAPI(0), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for success
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify data
    expect(result.current.data).toBeDefined();
    expect(result.current.data?.site.name).toBe('Arguel');
    expect(result.current.data?.paraIndex).toBe(75);
    expect(result.current.data?.windDirection).toBe('W');
  });

  it('should fetch best spot for day 3', async () => {
    const { result } = renderHook(() => useBestSpotAPI(3), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.site.name).toBe('Mont Poupet Ouest');
    expect(result.current.data?.paraIndex).toBe(65);
  });

  it('should cache results per day', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Fetch day 0
    const { result: result0 } = renderHook(() => useBestSpotAPI(0), {
      wrapper,
    });
    await waitFor(() => expect(result0.current.isSuccess).toBe(true));

    // Fetch day 1
    const { result: result1 } = renderHook(() => useBestSpotAPI(1), {
      wrapper,
    });
    await waitFor(() => expect(result1.current.isSuccess).toBe(true));

    // Verify separate cache keys
    const cache0 = queryClient.getQueryData(['bestSpot', 0]);
    const cache1 = queryClient.getQueryData(['bestSpot', 1]);

    expect(cache0).toBeDefined();
    expect(cache1).toBeDefined();
    expect(cache0).not.toEqual(cache1); // Different data
  });

  it('should handle 500 errors', async () => {
    server.use(
      http.get('*/api/spots/best', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    const { result } = renderHook(() => useBestSpotAPI(0), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });

  it('should handle 404 when no spots available', async () => {
    server.use(
      http.get('*/api/spots/best', () => {
        return new HttpResponse(
          JSON.stringify({ detail: 'No forecast data available' }),
          { status: 404 }
        );
      })
    );

    const { result } = renderHook(() => useBestSpotAPI(0), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('should handle 422 validation error for invalid day_index', async () => {
    // The hook itself doesn't validate, but the API should return 422
    server.use(
      http.get('*/api/spots/best', ({ request }) => {
        const url = new URL(request.url);
        const dayIndex = parseInt(url.searchParams.get('day_index') || '0');

        if (dayIndex < 0 || dayIndex > 6) {
          return new HttpResponse(
            JSON.stringify({
              detail: [
                {
                  loc: ['query', 'day_index'],
                  msg: 'ensure this value is greater than or equal to 0',
                  type: 'value_error',
                },
              ],
            }),
            { status: 422 }
          );
        }

        return HttpResponse.json(mockBestSpot);
      })
    );

    const { result } = renderHook(() => useBestSpotAPI(10), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('should use correct query parameters', async () => {
    let capturedUrl: string | null = null;

    server.use(
      http.get('*/api/spots/best', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(mockBestSpot);
      })
    );

    const { result } = renderHook(() => useBestSpotAPI(3), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl).toContain('day_index=3');
  });

  it('should default to day_index=0 when not specified', async () => {
    let capturedUrl: string | null = null;

    server.use(
      http.get('*/api/spots/best', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(mockBestSpot);
      })
    );

    const { result } = renderHook(() => useBestSpotAPI(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl).toContain('day_index=0');
  });
});
