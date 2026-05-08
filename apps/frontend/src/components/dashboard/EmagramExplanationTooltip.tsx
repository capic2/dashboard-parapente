import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';
import { parseAnalysisExplanation } from '../../types/emagram';
import type { EmagramAnalysis } from '../../types/emagram';

interface EmagramExplanationTooltipProps {
  emagram: EmagramAnalysis;
  compact?: boolean;
}

export function EmagramExplanationTooltip({
  emagram,
  compact = false,
}: EmagramExplanationTooltipProps) {
  const explanation = parseAnalysisExplanation(emagram.ai_raw_response);
  if (!explanation) return null;

  const sourceEntries = Object.entries(explanation.par_source);
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
      <Tooltip className="max-w-sm rounded-lg border border-purple-200 bg-white p-3 text-xs text-gray-700 shadow-xl dark:border-purple-700 dark:bg-gray-900 dark:text-gray-200">
        <div className="space-y-2">
          <div className="font-semibold text-purple-800 dark:text-purple-200">
            {label}
          </div>
          {explanation.resume && <p>{explanation.resume}</p>}
          {explanation.indices.length > 0 && (
            <ul className="space-y-1 pl-4">
              {explanation.indices.map((indice) => (
                <li key={indice} className="list-disc">
                  {indice}
                </li>
              ))}
            </ul>
          )}
          {sourceEntries.length > 0 && (
            <div className="space-y-1 border-t border-gray-100 pt-2 dark:border-gray-700">
              {sourceEntries.map(([source, observations]) => (
                <div key={source}>
                  <div className="font-medium capitalize text-gray-800 dark:text-gray-100">
                    {source.replace('-', ' ')}
                  </div>
                  <ul className="space-y-0.5 pl-4">
                    {observations.map((observation) => (
                      <li key={observation} className="list-disc">
                        {observation}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
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
