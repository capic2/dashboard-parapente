import { render, within, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import Header from './Header';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const translations: Record<string, string> = {
        'header.title': 'Paragliding Dashboard',
        'header.weather': 'Weather',
        'header.dashboard': 'Dashboard',
        'header.flights': 'Flights',
        'header.analytics': 'Analytics',
        'header.sites': 'Sites',
        'header.settings': 'Settings',
        'header.infrastructure': 'Infrastructure',
        'header.logout': 'Logout',
        'header.login': 'Login',
        'header.openMenu': 'Open menu',
        'header.closeMenu': 'Close menu',
        'header.menu': 'Menu',
        'settings.languageTheme.theme': 'Theme',
        'settings.languageTheme.light': 'Light',
        'settings.languageTheme.dark': 'Dark',
        'settings.languageTheme.auto': 'Auto',
      };

      return translations[key] ?? fallback ?? key;
    },
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    [key: string]: unknown;
  }) => (
    <a href={String(to)} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useMatchRoute: () => false,
}));

vi.mock('react-aria-components', () => {
  const MockCloseButton = ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    return <button {...props}>{children}</button>;
  };

  return {
    Button: MockCloseButton,
    DialogTrigger: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Modal: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    ModalOverlay: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Dialog: ({
      children,
    }: {
      children:
        | ((args: { close: () => void }) => React.ReactNode)
        | React.ReactNode;
    }) => {
      return (
        <div>
          {typeof children === 'function'
            ? children({ close: () => undefined })
            : children}
        </div>
      );
    },
  };
});

describe('Header theme controls', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    useThemeStore.setState({ preference: 'light', resolved: 'light' });
    useAuthStore.setState({ isAuthenticated: false, token: null });
  });

  it('opens the desktop theme selector and applies dark mode', () => {
    const { container } = render(<Header />);
    const desktopThemeSelector = container.querySelector(
      '[data-theme-selector="desktop"]'
    ) as HTMLElement;
    const desktopButton = within(desktopThemeSelector).getByRole('button');

    fireEvent.click(desktopButton);

    const darkOption = within(desktopThemeSelector).getByRole('button', {
      name: '🌙 Dark',
    });
    fireEvent.click(darkOption);

    expect(useThemeStore.getState().preference).toBe('dark');
  });

  it('opens the mobile theme selector and applies auto mode', () => {
    const { container } = render(<Header />);
    const mobileThemeSelector = container.querySelector(
      '[data-theme-selector="mobile"]'
    ) as HTMLElement;
    const mobileButton = within(mobileThemeSelector).getByRole('button', {
      name: /Theme/,
    });

    fireEvent.click(mobileButton);

    const autoOption = within(mobileThemeSelector).getByRole('button', {
      name: '🔄 Auto',
    });
    fireEvent.click(autoOption);

    expect(useThemeStore.getState().preference).toBe('auto');
  });
});
