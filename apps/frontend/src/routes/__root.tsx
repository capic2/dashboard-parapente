import { Suspense, useState } from 'react';
import { createRootRoute, Outlet, useMatchRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { ExternalLink, X } from 'lucide-react';
import Header from '../components/common/Header';
import { NativeGpxImportHandler } from '../components/common/NativeGpxImportHandler';
import AppUpdateBanner from '../components/common/AppUpdateBanner';
import DeploymentStatusBanner from '../components/common/DeploymentStatusBanner';
import { queryClient } from '../lib/queryClient';
import {
  appVersionQueryOptions,
  type AppVersionPayload,
} from '../hooks/common/useAppVersion';
import { useVersionUpdates } from '../hooks/common/useVersionUpdates';
import { getStagingPrNumber } from '../lib/appEnvironment';

export const Route = createRootRoute({
  loader: ({ location }) => {
    if (
      location.pathname === '/login' ||
      location.pathname === '/export-viewer' ||
      location.pathname === '/privacy'
    ) {
      return null;
    }

    return queryClient.ensureQueryData(appVersionQueryOptions());
  },
  component: RootComponent,
  pendingComponent: PendingComponent,
});

function PendingComponent() {
  return (
    <div className="min-h-screen overflow-x-clip bg-gray-50 p-3 text-gray-900 transition-colors dark:bg-gray-900 dark:text-gray-100 md:p-4">
      <div className="max-w-7xl mx-auto">
        <Header />
        <main>
          <div className="py-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-md animate-pulse">
              <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded mb-4 w-1/3"></div>
              <div className="h-64 bg-gray-200 dark:bg-gray-600 rounded"></div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function RootComponent() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const isLoginPage = matchRoute({ to: '/login' });
  const isExportViewerPage = matchRoute({ to: '/export-viewer' });
  const isPrivacyPage = matchRoute({ to: '/privacy' });
  const isInfrastructurePage = matchRoute({
    to: '/infrastructure',
    fuzzy: true,
  });
  const isFlightHistoryPage =
    matchRoute({ to: '/flights' }) || matchRoute({ to: '/flights/$flightId' });
  const appVersion = Route.useLoaderData();
  const version = appVersion?.version ?? null;
  const stagingPrNumber = getStagingPrNumber(version);
  const { latestVersion, releaseNotesUrl } = useVersionUpdates(
    isLoginPage || isExportViewerPage ? null : version
  );

  if (isLoginPage || isExportViewerPage || isPrivacyPage) {
    return (
      <>
        <NativeGpxImportHandler />
        <Outlet />
      </>
    );
  }

  return (
    <div
      className={`min-h-screen overflow-x-clip bg-gray-50 p-3 text-gray-900 transition-colors dark:bg-gray-900 dark:text-gray-100 md:p-4 ${
        isFlightHistoryPage
          ? 'lg:fixed lg:inset-0 lg:h-dvh lg:min-h-0 lg:overflow-hidden'
          : ''
      }`}
    >
      <NativeGpxImportHandler />
      <div
        className={`max-w-7xl mx-auto ${
          isFlightHistoryPage ? 'lg:flex lg:h-full lg:min-h-0 lg:flex-col' : ''
        }`}
      >
        {latestVersion && (
          <AppUpdateBanner
            title={t('appUpdate.title')}
            message={t('appUpdate.message', {
              version: latestVersion,
            })}
            viewWhatsNewLabel={t('appUpdate.viewWhatsNew')}
            refreshLabel={t('appUpdate.refresh')}
            releaseNotesUrl={releaseNotesUrl}
            onRefresh={() => window.location.reload()}
          />
        )}
        {!isInfrastructurePage && <DeploymentStatusBanner />}
        <Header />
        <main
          className={
            isFlightHistoryPage
              ? 'lg:flex lg:min-h-0 lg:flex-1 lg:flex-col'
              : undefined
          }
        >
          <Suspense>
            <Outlet />
          </Suspense>
        </main>
      </div>
      {appVersion && <VersionBadge appVersion={appVersion} />}
      {stagingPrNumber && <StagingPrBadge prNumber={stagingPrNumber} />}
    </div>
  );
}

function VersionBadge({ appVersion }: { appVersion: AppVersionPayload }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="flex justify-end py-2 lg:fixed lg:bottom-3 lg:right-3 lg:z-30 lg:py-0">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-haspopup="dialog"
          className="cursor-pointer rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm transition-colors hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-sky-800 dark:bg-gray-900/90 dark:text-sky-300 dark:hover:bg-gray-800 lg:backdrop-blur"
        >
          {t('versionInfo.badge', { version: appVersion.version })}
        </button>
      </div>
      <ModalOverlay
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        isDismissable
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <Modal className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl outline-none dark:border-gray-700 dark:bg-gray-900">
          <Dialog className="outline-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Heading
                  slot="title"
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  {t('versionInfo.title', { version: appVersion.version })}
                </Heading>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  {t('versionInfo.buildDetails', {
                    date: appVersion.build_date,
                    number: appVersion.build_number,
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t('versionInfo.close')}
                className="-mr-2 -mt-2 inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-700">
              {appVersion.release_notes_url ? (
                <a
                  href={appVersion.release_notes_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                >
                  {t('versionInfo.viewReleaseNotes')}
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {t('versionInfo.noReleaseNotes')}
                </p>
              )}
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}

function StagingPrBadge({ prNumber }: { prNumber: string }) {
  return (
    <a
      href={`https://github.com/capic2/dashboard-parapente/pull/${prNumber}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-3 left-3 z-30 rounded-full border border-amber-200 bg-amber-50/95 px-3 py-1 text-xs font-semibold text-amber-800 shadow-sm backdrop-blur hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/95 dark:text-amber-200 dark:hover:bg-amber-900"
    >
      PR #{prNumber}
    </a>
  );
}
