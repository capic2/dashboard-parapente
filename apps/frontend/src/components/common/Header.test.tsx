import { fireEvent, render, screen } from '@testing-library/react';
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
  withTranslation: () => (Component: unknown) => Component,
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

vi.mock('react-aria-components', async () => {
  const React = await import('react');

  const MockButton = ({
    children,
    onPress,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    onPress?: () => void;
  }) => {
    return (
      <button type="button" onClick={onPress} {...props}>
        {children}
      </button>
    );
  };

  const MenuTrigger = ({ children }: { children: React.ReactNode }) => {
    const [open, setOpen] = React.useState(false);
    const childArray = React.Children.toArray(children);
    const trigger = childArray[0];

    return (
      <div>
        {React.isValidElement<React.ButtonHTMLAttributes<HTMLButtonElement>>(
          trigger
        )
          ? React.cloneElement(trigger, {
              onClick: () => setOpen((current) => !current),
            })
          : trigger}
        {open ? childArray[1] : null}
      </div>
    );
  };

  const MenuItem = ({
    children,
    onAction,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    onAction?: () => void;
  }) => {
    return (
      <button type="button" onClick={onAction} {...props}>
        {children}
      </button>
    );
  };

  return {
    Button: MockButton,
    DialogTrigger: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Menu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    MenuItem,
    MenuTrigger,
    Modal: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    ModalOverlay: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Popover: ({ children }: { children: React.ReactNode }) => (
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
    render(<Header />);
    const desktopButton = screen.getAllByRole('button', {
      name: /Theme : Light/,
    })[0]!;

    fireEvent.click(desktopButton);

    const darkOption = screen.getByRole('button', {
      name: '🌙 Dark',
    });
    fireEvent.click(darkOption);

    expect(useThemeStore.getState().preference).toBe('dark');
  });

  it('opens the mobile theme selector and applies auto mode', () => {
    render(<Header />);
    const mobileButton = screen.getAllByRole('button', {
      name: /Theme : Light/,
    })[1]!;

    fireEvent.click(mobileButton);

    const autoOption = screen.getByRole('button', {
      name: '🔄 Auto',
    });
    fireEvent.click(autoOption);

    expect(useThemeStore.getState().preference).toBe('auto');
  });
});
