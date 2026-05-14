import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

type VerdictTone = 'good' | 'medium' | 'limit' | 'bad';

type VerdictVisual = {
  tone: VerdictTone;
  Icon: LucideIcon;
  badgeClassName: string;
  softClassName: string;
  borderSoftClassName: string;
  textClassName: string;
};

const verdictVisuals: Record<VerdictTone, VerdictVisual> = {
  good: {
    tone: 'good',
    Icon: CheckCircle2,
    badgeClassName:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
    softClassName:
      'bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30',
    borderSoftClassName:
      'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
    textClassName: 'text-emerald-700 dark:text-emerald-300',
  },
  medium: {
    tone: 'medium',
    Icon: CircleAlert,
    badgeClassName:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
    softClassName:
      'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30',
    borderSoftClassName: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20',
    textClassName: 'text-amber-700 dark:text-amber-300',
  },
  limit: {
    tone: 'limit',
    Icon: AlertTriangle,
    badgeClassName:
      'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
    softClassName:
      'bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30',
    borderSoftClassName: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20',
    textClassName: 'text-orange-700 dark:text-orange-300',
  },
  bad: {
    tone: 'bad',
    Icon: XCircle,
    badgeClassName:
      'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-100',
    softClassName:
      'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30',
    borderSoftClassName: 'border-red-500 bg-red-50 dark:bg-red-900/20',
    textClassName: 'text-red-700 dark:text-red-300',
  },
};

export const weatherCardClassName =
  'rounded-2xl border border-slate-200 bg-white/95 shadow-lg shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-black/25';

export const weatherSectionTitleClassName =
  'text-sm font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400';

export const weatherMetricTileClassName =
  'rounded-xl border border-slate-100 bg-slate-50/90 p-3 dark:border-slate-800 dark:bg-slate-950/50';

export const getVerdictVisual = (verdict: string): VerdictVisual => {
  const normalized = verdict.toLowerCase();

  if (normalized === 'bon' || normalized === 'excellent')
    return verdictVisuals.good;
  if (normalized === 'moyen') return verdictVisuals.medium;
  if (normalized === 'limite') return verdictVisuals.limit;

  return verdictVisuals.bad;
};
