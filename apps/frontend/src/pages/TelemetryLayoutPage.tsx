import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, Gauge } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TelemetryLayoutEditor } from '../components/telemetry/TelemetryLayoutEditor';

export function GlobalTelemetryLayoutPage() {
  return <TelemetryLayoutPage />;
}

export function FlightTelemetryLayoutPage() {
  const { flightId } = useParams({ strict: false });
  return <TelemetryLayoutPage flightId={flightId} />;
}

function TelemetryLayoutPage({ flightId }: { flightId?: string }) {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Link
              to={flightId ? '/flights/$flightId' : '/settings'}
              params={flightId ? { flightId } : undefined}
              className="inline-flex items-center gap-1 hover:text-sky-600"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('telemetryLayout.back')}
            </Link>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
              <Gauge className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                {flightId
                  ? t('telemetryLayout.flightTitle')
                  : t('telemetryLayout.title')}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                {flightId
                  ? t('telemetryLayout.flightDescription')
                  : t('telemetryLayout.description')}
              </p>
            </div>
          </div>
        </div>
      </div>
      <TelemetryLayoutEditor flightId={flightId} />
    </main>
  );
}
