import { Button } from '@dashboard-parapente/design-system';

type AppUpdateBannerProps = {
  title: string;
  message: string;
  viewWhatsNewLabel: string;
  refreshLabel: string;
  releaseNotesUrl: string | null;
  onRefresh: () => void;
};

export default function AppUpdateBanner({
  title,
  message,
  viewWhatsNewLabel,
  refreshLabel,
  releaseNotesUrl,
  onRefresh,
}: AppUpdateBannerProps) {
  return (
    <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-sm dark:border-amber-700 dark:bg-amber-900/30">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-amber-900 dark:text-amber-100">
          <p className="font-semibold">{title}</p>
          <p>{message}</p>
        </div>
        <div className="flex items-center gap-2">
          {releaseNotesUrl && (
            <a
              href={releaseNotesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center rounded-md border border-amber-500 px-3 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-400 dark:text-amber-100 dark:hover:bg-amber-800/40"
            >
              {viewWhatsNewLabel}
            </a>
          )}
          <Button onClick={onRefresh} size="sm">
            {refreshLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
