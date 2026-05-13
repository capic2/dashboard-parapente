import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  Button as AriaButton,
  Dialog,
  DialogTrigger,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
} from 'react-aria-components';
import { MonitorCog, Moon, Sun } from 'lucide-react';
import { Button } from '@dashboard-parapente/design-system';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore, type ThemePreference } from '../../stores/themeStore';

const linkClass =
  'px-3.5 py-2 rounded-md text-gray-600 dark:text-gray-300 text-sm transition-all hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sky-600 [&.active]:bg-sky-600 [&.active]:text-white';

const drawerLinkClass =
  'block py-3 px-4 min-h-11 rounded-md text-gray-700 dark:text-gray-200 text-base transition-all hover:bg-gray-100 dark:hover:bg-gray-700 [&.active]:bg-sky-600 [&.active]:text-white';

const themeIcons = {
  light: Sun,
  dark: Moon,
  auto: MonitorCog,
};

const themeOptions: ThemePreference[] = ['light', 'dark', 'auto'];

export default function Header() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { preference: themePreference, setPreference: setThemePreference } =
    useThemeStore();

  function handleLogout() {
    logout();
    navigate({ to: '/login' });
  }

  const navLinks = (linkClassName: string, onNavigate?: () => void) => (
    <>
      {isAuthenticated && (
        <Link to="/" className={linkClassName} onClick={onNavigate}>
          {t('header.dashboard')}
        </Link>
      )}
      <Link to="/weather" className={linkClassName} onClick={onNavigate}>
        {t('header.weather')}
      </Link>
      {isAuthenticated && (
        <>
          <Link to="/flights" className={linkClassName} onClick={onNavigate}>
            {t('header.flights')}
          </Link>
          <Link to="/analytics" className={linkClassName} onClick={onNavigate}>
            {t('header.analytics')}
          </Link>
          <Link to="/sites" className={linkClassName} onClick={onNavigate}>
            {t('header.sites')}
          </Link>
          <Link
            to="/gopro-overlay"
            className={linkClassName}
            onClick={onNavigate}
          >
            {t('header.goproOverlay')}
          </Link>
          <Link to="/settings" className={linkClassName} onClick={onNavigate}>
            {t('header.settings')}
          </Link>
          <Link to="/infrastructure" className={linkClass} onClick={onNavigate}>
            {t('header.infrastructure')}
          </Link>
          <a
            href="http://portainer.local:9000"
            target="_blank"
            rel="noopener noreferrer"
            className={
              linkClassName === drawerLinkClass
                ? 'block py-3 px-4 min-h-11 rounded-md bg-cyan-500 text-white text-sm font-medium transition-all hover:bg-cyan-600 no-print'
                : 'px-3 py-1.5 rounded-md bg-cyan-500 text-white text-xs font-medium transition-all hover:bg-cyan-600 hover:-translate-y-0.5 no-print'
            }
            title="Portainer"
            onClick={onNavigate}
          >
            Portainer
          </a>
        </>
      )}
    </>
  );

  function handleThemeSelect(next: ThemePreference) {
    setThemePreference(next);
  }

  const ActiveThemeIcon = themeIcons[themePreference];
  const themeTooltip = `${t('settings.languageTheme.theme')} : ${t(
    `settings.languageTheme.${themePreference}`
  )}`;

  return (
    <header className="mb-4 flex items-center justify-between gap-2.5 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-black/25">
      <h1 className="text-2xl sm:text-xl text-sky-600 dark:text-sky-400 font-semibold min-w-0 sm:min-w-[200px] m-0 truncate">
        {t('header.title')}
      </h1>

      {/* Desktop navigation */}
      <nav className="hidden sm:flex gap-2 flex-wrap items-center">
        {navLinks(linkClass)}
        <MenuTrigger>
          <AriaButton
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-100 text-sm font-medium transition-all hover:bg-gray-300 dark:hover:bg-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            aria-label={`${t('settings.languageTheme.theme')} : ${t(
              `settings.languageTheme.${themePreference}`
            )}`}
          >
            <ActiveThemeIcon className="h-4 w-4" aria-hidden="true" />
            {t(`settings.languageTheme.${themePreference}`)}
          </AriaButton>
          <Popover className="z-40 mt-2 w-44 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-1 theme-menu-popin">
            <Menu className="outline-none">
              {themeOptions.map((theme) => {
                const isActive = theme === themePreference;
                const ThemeIcon = themeIcons[theme];
                return (
                  <MenuItem
                    key={theme}
                    onAction={() => handleThemeSelect(theme)}
                    className={`w-full rounded-md px-3 py-2 text-sm transition-all min-h-10 flex items-center justify-between cursor-pointer ${
                      isActive
                        ? 'bg-sky-600 text-white'
                        : 'text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <ThemeIcon className="h-4 w-4" aria-hidden="true" />
                      {t(`settings.languageTheme.${theme}`)}
                    </span>
                    {isActive && <span aria-hidden="true">✓</span>}
                  </MenuItem>
                );
              })}
            </Menu>
          </Popover>
        </MenuTrigger>
        {isAuthenticated ? (
          <Button
            onClick={handleLogout}
            size="sm"
            variant="secondary"
            className="px-3 py-1.5 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium transition-all hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900 dark:hover:text-red-300"
          >
            {t('header.logout', 'Logout')}
          </Button>
        ) : (
          <Link
            to="/login"
            className="px-3.5 py-2 rounded-md bg-sky-600 text-white text-sm font-medium transition-all hover:bg-sky-700"
          >
            {t('header.login', 'Login')}
          </Link>
        )}
      </nav>

      {/* Mobile theme quick toggle + menu */}
      <div className="sm:hidden flex items-center gap-2 relative">
        <MenuTrigger>
          <AriaButton
            className="min-h-11 min-w-11 flex items-center justify-center rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            aria-label={themeTooltip}
          >
            <span
              aria-hidden="true"
              className="text-lg leading-none inline-block"
            >
              <ActiveThemeIcon className="h-5 w-5" aria-hidden="true" />
            </span>
          </AriaButton>
          <Popover className="z-40 mt-2 w-44 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-1 theme-menu-popin">
            <Menu className="outline-none">
              {themeOptions.map((theme) => {
                const isActive = theme === themePreference;
                const ThemeIcon = themeIcons[theme];
                return (
                  <MenuItem
                    key={theme}
                    onAction={() => handleThemeSelect(theme)}
                    className={`w-full rounded-md px-3 py-2 text-sm transition-all min-h-10 flex items-center justify-between cursor-pointer ${
                      isActive
                        ? 'bg-sky-600 text-white'
                        : 'text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <ThemeIcon className="h-4 w-4" aria-hidden="true" />
                      {t(`settings.languageTheme.${theme}`)}
                    </span>
                    {isActive && <span aria-hidden="true">✓</span>}
                  </MenuItem>
                );
              })}
            </Menu>
          </Popover>
        </MenuTrigger>
        <DialogTrigger isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <AriaButton
            aria-label={t('header.openMenu', 'Ouvrir le menu')}
            className="min-h-11 min-w-11 flex items-center justify-center rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </AriaButton>
          <ModalOverlay
            className="fixed inset-0 z-50 bg-black/40"
            isDismissable
          >
            <Modal className="fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-800 shadow-xl outline-none animate-[slide-in_0.2s_ease-out]">
              <Dialog className="h-full flex flex-col outline-none">
                {({ close }: { close: () => void }) => (
                  <>
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        {t('header.menu', 'Menu')}
                      </span>
                      <AriaButton
                        onPress={close}
                        aria-label={t('header.closeMenu', 'Fermer le menu')}
                        className="min-h-11 min-w-11 flex items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </AriaButton>
                    </div>
                    <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
                      {navLinks(drawerLinkClass, close)}
                    </nav>
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                      {isAuthenticated ? (
                        <Button
                          onClick={() => {
                            close();
                            handleLogout();
                          }}
                          size="sm"
                          variant="secondary"
                          className="w-full py-3 px-4 min-h-11 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium transition-all hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900 dark:hover:text-red-300"
                        >
                          {t('header.logout', 'Logout')}
                        </Button>
                      ) : (
                        <Link
                          to="/login"
                          onClick={() => close()}
                          className="block w-full py-3 px-4 min-h-11 text-center rounded-md bg-sky-600 text-white text-sm font-medium transition-all hover:bg-sky-700"
                        >
                          {t('header.login', 'Login')}
                        </Link>
                      )}
                    </div>
                  </>
                )}
              </Dialog>
            </Modal>
          </ModalOverlay>
        </DialogTrigger>
      </div>
    </header>
  );
}
