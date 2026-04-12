import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  Button as AriaButton,
  Dialog,
  DialogTrigger,
  Modal,
  ModalOverlay,
} from 'react-aria-components';
import { Button } from '@dashboard-parapente/design-system';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore, type ThemePreference } from '../../stores/themeStore';

const linkClass =
  'px-3.5 py-2 rounded-md text-gray-600 dark:text-gray-300 text-sm transition-all hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sky-600 [&.active]:bg-sky-600 [&.active]:text-white';

const drawerLinkClass =
  'block py-3 px-4 min-h-11 rounded-md text-gray-700 dark:text-gray-200 text-base transition-all hover:bg-gray-100 dark:hover:bg-gray-700 [&.active]:bg-sky-600 [&.active]:text-white';

const themeIcons: Record<ThemePreference, string> = {
  light: '☀️',
  dark: '🌙',
  auto: '🔄',
};

const themeOptions: ThemePreference[] = ['light', 'dark', 'auto'];

export default function Header() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isThemeMenuOpenDesktop, setIsThemeMenuOpenDesktop] = useState(false);
  const [isThemeMenuOpenMobile, setIsThemeMenuOpenMobile] = useState(false);
  const [themeAnimationIndex, setThemeAnimationIndex] = useState(0);
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
    setIsThemeMenuOpenDesktop(false);
    setIsThemeMenuOpenMobile(false);
  }

  function openDesktopThemeMenu() {
    setIsThemeMenuOpenDesktop((isOpen) => !isOpen);
    setIsThemeMenuOpenMobile(false);
  }

  function openMobileThemeMenu() {
    setIsThemeMenuOpenMobile((isOpen) => !isOpen);
    setIsThemeMenuOpenDesktop(false);
  }

  function closeThemeMenus() {
    setIsThemeMenuOpenDesktop(false);
    setIsThemeMenuOpenMobile(false);
  }

  const isAnyThemeMenuOpen = isThemeMenuOpenDesktop || isThemeMenuOpenMobile;

  useEffect(() => {
    setThemeAnimationIndex((value) => value + 1);
  }, [themePreference]);

  useEffect(() => {
    if (!isAnyThemeMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(
          '[data-theme-selector="desktop"], [data-theme-selector="mobile"]'
        )
      ) {
        return;
      }
      closeThemeMenus();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeThemeMenus();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isAnyThemeMenuOpen]);

  const desktopThemeMenuId = `theme-desktop-menu-${themeAnimationIndex}`;
  const mobileThemeMenuId = `theme-mobile-menu-${themeAnimationIndex}`;

  const themeLabel = `${themeIcons[themePreference]} ${t(
    `settings.languageTheme.${themePreference}`
  )}`;
  const themeTooltip = `${t('settings.languageTheme.theme')} : ${t(
    `settings.languageTheme.${themePreference}`
  )}`;

  return (
    <header className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 shadow-lg flex justify-between items-center gap-2.5">
      <h1 className="text-2xl sm:text-xl text-sky-600 font-semibold min-w-0 sm:min-w-[200px] m-0 truncate">
        {t('header.title')}
      </h1>

      {/* Desktop navigation */}
      <nav className="hidden sm:flex gap-2 flex-wrap items-center">
        {navLinks(linkClass)}
        <div className="relative" data-theme-selector="desktop">
          <button
            type="button"
            onClick={openDesktopThemeMenu}
            className="px-3 py-1.5 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-100 text-sm font-medium transition-all hover:bg-gray-300 dark:hover:bg-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            aria-label={`${t('settings.languageTheme.theme')} : ${t(
              `settings.languageTheme.${themePreference}`
            )}`}
            aria-expanded={isThemeMenuOpenDesktop}
            aria-controls={desktopThemeMenuId}
            title={themeTooltip}
            data-theme-trigger="desktop"
          >
            {themeLabel}
          </button>
          {isThemeMenuOpenDesktop && (
            <div
              id={desktopThemeMenuId}
              className="absolute right-0 top-full mt-2 z-40 w-44 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-1 theme-menu-popin"
            >
              {themeOptions.map((theme) => {
                const isActive = theme === themePreference;
                return (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => handleThemeSelect(theme)}
                    className={`w-full rounded-md px-3 py-2 text-sm text-left transition-all min-h-10 flex items-center justify-between ${
                      isActive
                        ? 'bg-sky-600 text-white'
                        : 'text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span>
                      {themeIcons[theme]} {t(`settings.languageTheme.${theme}`)}
                    </span>
                    {isActive && <span aria-hidden="true">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {isAuthenticated ? (
          <Button
            onClick={handleLogout}
            size="sm"
            tone="secondary"
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
      <div
        className="sm:hidden flex items-center gap-2 relative"
        data-theme-selector="mobile"
      >
        <button
          type="button"
          onClick={openMobileThemeMenu}
          className="min-h-11 min-w-11 flex items-center justify-center rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          aria-label={themeTooltip}
          aria-expanded={isThemeMenuOpenMobile}
          aria-controls={mobileThemeMenuId}
          title={themeTooltip}
          data-theme-trigger="mobile"
        >
          <span
            aria-hidden="true"
            key={`theme-switch-icon-${themeAnimationIndex}`}
            className="text-lg leading-none inline-block theme-change-pop"
          >
            {themeIcons[themePreference]}
          </span>
        </button>
        {isThemeMenuOpenMobile && (
          <div
            id={mobileThemeMenuId}
            className="absolute right-0 top-full mt-2 z-40 w-44 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-1 theme-menu-popin"
          >
            {themeOptions.map((theme) => {
              const isActive = theme === themePreference;
              return (
                <button
                  key={theme}
                  type="button"
                  onClick={() => handleThemeSelect(theme)}
                  className={`w-full rounded-md px-3 py-2 text-sm text-left transition-all min-h-10 flex items-center justify-between ${
                    isActive
                      ? 'bg-sky-600 text-white'
                      : 'text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span>
                    {themeIcons[theme]} {t(`settings.languageTheme.${theme}`)}
                  </span>
                  {isActive && <span aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
        )}
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
                {({ close }) => (
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
                          tone="secondary"
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
