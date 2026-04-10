import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';

const linkClass =
  'px-3.5 py-2 rounded-md text-gray-600 dark:text-gray-300 text-sm transition-all hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-sky-600 [&.active]:bg-sky-600 [&.active]:text-white';

export default function Header() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate({ to: '/login' });
  }

  return (
    <header className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 shadow-lg flex justify-between items-center flex-wrap gap-2.5">
      <h1 className="text-2xl sm:text-xl text-sky-600 font-semibold flex-1 min-w-[200px] m-0">
        {t('header.title')}
      </h1>
      <nav className="flex gap-2 flex-wrap items-center w-full sm:w-auto justify-center sm:justify-start">
        {isAuthenticated && (
          <Link to="/" className={linkClass}>
            {t('header.dashboard')}
          </Link>
        )}
        <Link to="/weather" className={linkClass}>
          {t('header.weather')}
        </Link>
        {isAuthenticated && (
          <>
            <Link to="/flights" className={linkClass}>
              {t('header.flights')}
            </Link>
            <Link to="/analytics" className={linkClass}>
              {t('header.analytics')}
            </Link>
            <Link to="/sites" className={linkClass}>
              {t('header.sites')}
            </Link>
            <Link to="/settings" className={linkClass}>
              {t('header.settings')}
            </Link>
            <Link to="/infrastructure" className={linkClass}>
              {t('header.infrastructure')}
            </Link>
            <a
              href="http://portainer.local:9000"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-md bg-cyan-500 text-white text-xs font-medium transition-all hover:bg-cyan-600 hover:-translate-y-0.5 no-print"
              title="Portainer"
            >
              Portainer
            </a>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium transition-all hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900 dark:hover:text-red-300"
            >
              {t('header.logout', 'Logout')}
            </button>
          </>
        )}
        {!isAuthenticated && (
          <Link
            to="/login"
            className="px-3.5 py-2 rounded-md bg-sky-600 text-white text-sm font-medium transition-all hover:bg-sky-700"
          >
            {t('header.login', 'Login')}
          </Link>
        )}
      </nav>
    </header>
  );
}
