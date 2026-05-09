import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';
import { parseAnalysisExplanation } from '../../types/emagram';
import type {
  EmagramAnalysis,
  EmagramAnalysisExplanation,
} from '../../types/emagram';

const SOURCE_LABELS: Record<string, string> = {
  'meteo-parapente': 'Météo-Parapente',
  meteociel: 'Meteociel',
  topmeteo: 'TopMeteo',
};

const SOURCE_READING_HINTS: Record<string, string> = {
  'meteo-parapente':
    "Sur Météo-Parapente, commence par comparer la courbe de température et celle du point de rosée, puis vérifie le plafond et le vent avec l'altitude.",
  meteociel:
    "Sur Meteociel, les profils type Skew-T se lisent surtout avec la courbe température, la courbe point de rosée et les barbules de vent à droite.",
};

const CURVE_READING_GUIDE = [
  {
    label: 'Température',
    recognize:
      "courbe principale du profil thermique, souvent rouge ou foncée, qui monte avec l'altitude sur le diagramme.",
    meaning:
      "elle montre comment l'air ambiant se refroidit. Une baisse régulière favorise les ascendances ; une cassure ou remontée indique une couche stable.",
  },
  {
    label: 'Point de rosée',
    recognize:
      'courbe d’humidité, souvent verte ou bleue, tracée à côté de la température.',
    meaning:
      'plus elle se rapproche de la température, plus l’air est humide et plus une base nuageuse est probable.',
  },
  {
    label: 'Écart température / point de rosée',
    recognize:
      'distance horizontale entre les deux courbes température et point de rosée.',
    meaning:
      'petit écart = air humide/nuages possibles ; grand écart = air sec, base plus haute ou déclenchement plus difficile.',
  },
  {
    label: 'Parcelle thermique',
    recognize:
      'courbe de trajectoire d’une bulle d’air si elle est affichée, parfois en pointillés ou en courbe secondaire.',
    meaning:
      "si la parcelle reste plus chaude que l'environnement, elle peut monter ; quand elle rejoint l'environnement, le thermique s'arrête.",
  },
  {
    label: 'Base nuageuse / LCL',
    recognize:
      'niveau où température et point de rosée convergent, ou repère explicite de base/plafond.',
    meaning:
      'donne une estimation du plafond exploitable et de la marge au-dessus du relief.',
  },
  {
    label: 'Inversion ou couche stable',
    recognize:
      'portion où la température baisse très peu, devient verticale ou remonte avec l’altitude.',
    meaning:
      'elle bloque ou affaiblit les thermiques ; un plafond annoncé au-dessus peut être difficile à atteindre.',
  },
  {
    label: 'Vent altitude',
    recognize:
      'barbules, flèches ou valeurs de vent par niveau, souvent sur le côté du diagramme.',
    meaning:
      'renforcement ou rotation rapide = dérive, cisaillement et turbulence possibles.',
  },
];

interface EmagramExplanationTooltipProps {
  emagram: EmagramAnalysis;
  compact?: boolean;
}

function getSourceLabel(source: string): string {
  return (
    SOURCE_LABELS[source] ??
    source
      .replace(/-/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
}

function parseScreenshotSources(
  screenshotPaths: string | null | undefined
): string[] {
  if (!screenshotPaths) return [];

  try {
    const parsed = JSON.parse(screenshotPaths);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return [];
    }
    const pathsBySource = parsed as Record<string, unknown>;
    return Object.keys(pathsBySource).filter((source) =>
      Boolean(pathsBySource[source])
    );
  } catch {
    return [];
  }
}

function uniqueSources(...sourceGroups: string[][]): string[] {
  return sourceGroups.flat().filter((source, index, sources) => {
    return Boolean(source) && sources.indexOf(source) === index;
  });
}

export function EmagramExplanationTooltip({
  emagram,
  compact = false,
}: EmagramExplanationTooltipProps) {
  const screenshotSources = parseScreenshotSources(emagram.screenshot_paths);
  const explanation = parseAnalysisExplanation(emagram.ai_raw_response);
  if (!explanation && screenshotSources.length === 0) return null;

  const explanationContent: EmagramAnalysisExplanation = explanation ?? {
    resume: null,
    indices: [],
    par_source: {},
  };
  const sourceEntries = Object.entries(explanationContent.par_source);
  const sources = uniqueSources(
    screenshotSources,
    sourceEntries.map(([source]) => source)
  );
  const label = "Comment l'IA a analysé ?";

  return (
    <TooltipTrigger>
      <Button
        className={`inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-900/30 dark:text-purple-200 dark:hover:bg-purple-900/50 transition-colors cursor-pointer ${
          compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
        }`}
        aria-label={label}
      >
        <span aria-hidden="true">?</span>
        {!compact && <span>{label}</span>}
      </Button>
      <Tooltip className="max-h-[80vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto rounded-lg border border-purple-200 bg-white p-3 text-xs text-gray-700 shadow-xl dark:border-purple-700 dark:bg-gray-900 dark:text-gray-200">
        <div className="space-y-3">
          <div className="font-semibold text-purple-800 dark:text-purple-200">
            {label}
          </div>
          {explanationContent.resume && <p>{explanationContent.resume}</p>}
          {sources.length > 0 && (
            <div className="space-y-3 border-t border-gray-100 pt-2 dark:border-gray-700">
              <div className="font-semibold text-gray-900 dark:text-gray-100">
                Lecture par émagramme
              </div>
              {sources.map((source) => {
                const observations = explanationContent.par_source[source] ?? [];
                return (
                  <div
                    key={source}
                    className="rounded-md border border-gray-100 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800/60"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {getSourceLabel(source)}
                      </div>
                      {screenshotSources.includes(source) && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-200">
                          image capturée
                        </span>
                      )}
                    </div>
                    <p className="mb-2 text-[11px] text-gray-600 dark:text-gray-300">
                      {SOURCE_READING_HINTS[source] ??
                        "Lis cette image en comparant d'abord température, point de rosée, plafond et vent avec l'altitude."}
                    </p>
                    <div className="space-y-1.5">
                      {CURVE_READING_GUIDE.map((item) => (
                        <div key={item.label}>
                          <span className="font-medium text-gray-800 dark:text-gray-100">
                            {item.label}
                          </span>{' '}
                          <span className="text-gray-500 dark:text-gray-400">
                            Repère : {item.recognize} Sens : {item.meaning}
                          </span>
                        </div>
                      ))}
                    </div>
                    {observations.length > 0 && (
                      <div className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-700">
                        <div className="mb-1 font-medium text-gray-800 dark:text-gray-100">
                          Ce que l’IA observe sur cette image
                        </div>
                        <ul className="space-y-1 pl-4">
                          {observations.map((observation) => (
                            <li key={observation} className="list-disc">
                              {observation}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {explanationContent.indices.length > 0 && (
            <div className="border-t border-gray-100 pt-2 dark:border-gray-700">
              <div className="mb-1 font-semibold text-gray-900 dark:text-gray-100">
                Indices globaux
              </div>
              <ul className="space-y-1 pl-4">
                {explanationContent.indices.map((indice) => (
                  <li key={indice} className="list-disc">
                    {indice}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="border-t border-gray-100 pt-2 text-[11px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
            {emagram.llm_model ? `Modèle : ${emagram.llm_model}` : 'Analyse IA'}
            {emagram.sources_agreement
              ? ` • Consensus : ${emagram.sources_agreement}`
              : ''}
          </div>
        </div>
      </Tooltip>
    </TooltipTrigger>
  );
}
