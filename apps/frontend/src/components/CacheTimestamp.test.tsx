import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CacheTimestamp from './CacheTimestamp';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'weather.updatedAt': 'Mis à jour:',
        'weather.notCached': 'Non mis en cache',
      };
      return translations[key] || key;
    },
    i18n: { language: 'fr' },
  }),
}));

describe('CacheTimestamp', () => {
  it('renders "not cached" when cachedAt is null', () => {
    render(<CacheTimestamp cachedAt={null} />);
    expect(screen.getByText('Non mis en cache')).toBeInTheDocument();
  });

  it('renders "not cached" when cachedAt is undefined', () => {
    render(<CacheTimestamp cachedAt={undefined} />);
    expect(screen.getByText('Non mis en cache')).toBeInTheDocument();
  });

  it('renders relative time for a valid cachedAt', () => {
    // 30 minutes ago
    const thirtyMinAgo = new Date(
      Date.now() - 30 * 60 * 1000
    ).toISOString();

    render(<CacheTimestamp cachedAt={thirtyMinAgo} />);

    const el = screen.getByText(/Mis à jour:/);
    expect(el).toBeInTheDocument();
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toContain('text-xs');
    expect(el.className).toContain('text-gray-400');
  });

  it('shows full date in title attribute', () => {
    const cachedAt = '2026-03-29T12:00:00.000Z';

    render(<CacheTimestamp cachedAt={cachedAt} />);

    const el = screen.getByText(/Mis à jour:/);
    expect(el.title).toBeTruthy();
  });

  it('applies custom className', () => {
    const cachedAt = new Date().toISOString();

    render(<CacheTimestamp cachedAt={cachedAt} className="mt-2" />);

    const el = screen.getByText(/Mis à jour:/);
    expect(el.className).toContain('mt-2');
  });
});
