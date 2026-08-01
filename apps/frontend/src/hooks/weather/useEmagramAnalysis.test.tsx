import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTriggerEmagram } from './useEmagramAnalysis';

const { apiPost, responseJson } = vi.hoisted(() => ({
  apiPost: vi.fn(),
  responseJson: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: { post: apiPost },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'fr' } }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useTriggerEmagram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    responseJson.mockResolvedValue({ id: 'analysis-id' });
    apiPost.mockReturnValue({ json: responseJson });
  });

  it('does not apply the global request timeout to long analyses', async () => {
    const { result } = renderHook(() => useTriggerEmagram(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        site_id: 'site-la-cote',
        force_refresh: true,
        hour: 15,
      });
    });

    expect(apiPost).toHaveBeenCalledWith('emagram/analyze', {
      json: {
        locale: 'fr',
        site_id: 'site-la-cote',
        force_refresh: true,
        hour: 15,
      },
      timeout: false,
    });
  });
});
