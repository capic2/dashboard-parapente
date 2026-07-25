import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateFlightModal } from './CreateFlightModal';

describe('CreateFlightModal', () => {
  it('uses the requested creation mode when reopened', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const renderModal = (isOpen: boolean, initialMode: 'manual' | 'file') => (
      <QueryClientProvider client={queryClient}>
        <CreateFlightModal
          isOpen={isOpen}
          sites={[]}
          initialMode={initialMode}
          onClose={vi.fn()}
          onCreateComplete={vi.fn()}
        />
      </QueryClientProvider>
    );

    const view = render(renderModal(false, 'manual'));
    view.rerender(renderModal(false, 'file'));
    view.rerender(renderModal(true, 'file'));

    await waitFor(() =>
      expect(
        screen.getByRole('tab', { name: 'flights.importFile' })
      ).toHaveAttribute('aria-selected', 'true')
    );
  });
});
