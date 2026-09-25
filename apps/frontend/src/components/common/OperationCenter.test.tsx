import { render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackgroundOperation } from '@dashboard-parapente/shared-types';
import { OperationCenter } from './OperationCenter';

const operationMocks = vi.hoisted(() => ({
  useOperations: vi.fn(),
  useCancelOperation: vi.fn(),
  useMarkOperationRead: vi.fn(),
  useRetryOperation: vi.fn(),
}));

vi.mock('../../hooks/useOperations', () => operationMocks);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('react-aria-components', () => {
  const passthrough = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Button: ({
      children,
      onPress,
      ...props
    }: ComponentProps<'button'> & { onPress?: () => void }) => (
      <button onClick={onPress} {...props}>
        {children}
      </button>
    ),
    Dialog: passthrough,
    DialogTrigger: passthrough,
    Heading: passthrough,
    Modal: passthrough,
    ModalOverlay: passthrough,
    Popover: passthrough,
  };
});

function makeOperation(
  operationId: string,
  status: BackgroundOperation['status'],
  unread: boolean
): BackgroundOperation {
  return {
    operation_id: operationId,
    operation_type: `Export ${operationId}`,
    title_key: `operations.${operationId}`,
    status,
    progress: 50,
    current_step_key: 'render',
    current_step_progress: 13,
    current_step_detail: `Étape ${operationId}`,
    steps: [],
    can_cancel: status === 'running',
    can_retry: false,
    unread,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

describe('OperationCenter', () => {
  beforeEach(() => {
    operationMocks.useOperations.mockReturnValue({
      data: [
        makeOperation('annulé', 'cancelled', true),
        makeOperation('actif', 'running', false),
      ],
    });
    operationMocks.useCancelOperation.mockReturnValue({ mutateAsync: vi.fn() });
    operationMocks.useMarkOperationRead.mockReturnValue({
      mutateAsync: vi.fn(),
    });
    operationMocks.useRetryOperation.mockReturnValue({ mutateAsync: vi.fn() });
  });

  it('hides cancelled jobs and excludes them from the notification count', () => {
    render(<OperationCenter />);

    expect(screen.queryByText('Export annulé')).toBeNull();
    expect(screen.getByText('Export actif')).toBeTruthy();
    expect(screen.getByText('1 en cours')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Ouvrir les traitements' }).textContent
    ).toContain('1');
  });
});
