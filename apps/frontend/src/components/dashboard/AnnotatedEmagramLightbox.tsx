import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  formatConfidence,
  groupEmagramAnnotations,
  parseEmagramAnnotationModel,
  type EmagramAnnotationGroup,
  type EmagramImageAnnotation,
  type EmagramPanelExplanation,
} from '../../lib/emagramAnnotations';

export interface AnnotatedEmagramImage {
  src: string;
  alt: string;
  source: string;
}

interface AnnotatedEmagramLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  images: AnnotatedEmagramImage[];
  aiRawResponse: string | null | undefined;
  initialIndex?: number;
}

const ZOOM_LEVELS = [1, 1.5, 2] as const;

const priorityClass: Record<EmagramImageAnnotation['priority'], string> = {
  important: 'border-orange-500 bg-orange-500 text-white ring-orange-200',
  watch: 'border-amber-500 bg-amber-400 text-gray-950 ring-amber-200',
  educational: 'border-sky-500 bg-sky-500 text-white ring-sky-200',
};

const zoneClass: Record<EmagramImageAnnotation['priority'], string> = {
  important: 'border-orange-500 bg-orange-400/15',
  watch: 'border-amber-500 bg-amber-300/15',
  educational: 'border-sky-500 bg-sky-400/15',
};

function useCurrentIndex(
  isOpen: boolean,
  initialIndex: number,
  length: number
) {
  const [index, setIndex] = useState(initialIndex);
  useEffect(() => {
    if (isOpen)
      setIndex(Math.min(Math.max(initialIndex, 0), Math.max(length - 1, 0)));
  }, [initialIndex, isOpen, length]);
  return [index, setIndex] as const;
}

function AnnotationText({
  annotation,
}: {
  annotation: EmagramImageAnnotation | EmagramPanelExplanation;
}) {
  const { t } = useTranslation();
  const confidence = formatConfidence(annotation.confidence);
  return (
    <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
      <div className="flex flex-wrap items-center gap-2">
        <div className="font-semibold text-gray-950 dark:text-gray-50">
          {annotation.label}
        </div>
        {confidence && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {t('thermal.annotations.confidence', { value: confidence })}
          </span>
        )}
      </div>
      {'priority' in annotation && 'category' in annotation && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {t(`thermal.annotations.priority.${annotation.priority}`)} ·{' '}
          {t(`thermal.annotations.category.${annotation.category}`)}
        </div>
      )}
      {'reason' in annotation && annotation.reason && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {t(`thermal.annotations.reason.${annotation.reason}`)}
        </div>
      )}
      {annotation.term && annotation.termDefinition && (
        <div className="rounded-md bg-purple-50 p-2 text-xs text-purple-900 dark:bg-purple-900/30 dark:text-purple-100">
          <span className="font-semibold">
            {t('thermal.annotations.termToRemember')}: {annotation.term}
          </span>{' '}
          {annotation.termDefinition}
        </div>
      )}
      {annotation.visualCue && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('thermal.annotations.visualCue')}
          </div>
          <div>{annotation.visualCue}</div>
        </div>
      )}
      {annotation.weatherReading && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('thermal.annotations.weatherReading')}
          </div>
          <div>{annotation.weatherReading}</div>
        </div>
      )}
      {annotation.flightImpact && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('thermal.annotations.flightImpact')}
          </div>
          <div>{annotation.flightImpact}</div>
        </div>
      )}
      {'text' in annotation && annotation.text && <div>{annotation.text}</div>}
      {'uncertaintyNote' in annotation && annotation.uncertaintyNote && (
        <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
          {annotation.uncertaintyNote}
        </div>
      )}
    </div>
  );
}

function ExplanationPanel({
  title,
  model,
}: {
  title: string;
  model: ReturnType<typeof parseEmagramAnnotationModel>;
}) {
  const { t } = useTranslation();
  return (
    <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-3 font-semibold text-gray-950 dark:text-gray-50">
        {title}
      </div>
      <div className="space-y-4">
        {model.resume && (
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('thermal.annotations.globalSummary')}
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-200">
              {model.resume}
            </p>
          </section>
        )}
        {model.indices.length > 0 && (
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('thermal.annotations.flightTakeaways')}
            </h3>
            <ul className="space-y-1 pl-4 text-sm text-gray-700 dark:text-gray-200">
              {model.indices.map((indice) => (
                <li key={indice} className="list-disc">
                  {indice}
                </li>
              ))}
            </ul>
          </section>
        )}
        {model.panelExplanations.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('thermal.annotations.otherExplanations')}
            </h3>
            <div className="space-y-3">
              {model.panelExplanations.map((explanation) => (
                <div
                  key={explanation.id}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/70"
                >
                  <AnnotationText annotation={explanation} />
                </div>
              ))}
            </div>
          </section>
        )}
        {!model.resume &&
          model.indices.length === 0 &&
          model.panelExplanations.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('thermal.annotations.noExplanation')}
            </p>
          )}
      </div>
    </div>
  );
}

function GroupPopover({ group }: { group: EmagramAnnotationGroup }) {
  return (
    <div className="w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-3 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
      <div className="space-y-3">
        {group.annotations.map((annotation) => (
          <AnnotationText key={annotation.id} annotation={annotation} />
        ))}
      </div>
    </div>
  );
}

export function AnnotatedEmagramLightbox({
  isOpen,
  onClose,
  images,
  aiRawResponse,
  initialIndex = 0,
}: AnnotatedEmagramLightboxProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useCurrentIndex(
    isOpen,
    initialIndex,
    images.length
  );
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [hoverGroupId, setHoverGroupId] = useState<string | null>(null);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageSize, setImageSize] = useState({ width: 1000, height: 700 });
  const current = images[index];
  const zoom = ZOOM_LEVELS[zoomIndex];

  const model = useMemo(
    () => parseEmagramAnnotationModel(aiRawResponse, current?.source ?? ''),
    [aiRawResponse, current?.source]
  );
  const groups = useMemo(
    () =>
      annotationsVisible
        ? groupEmagramAnnotations(model.preciseAnnotations, {
            imageWidth: imageSize.width,
            imageHeight: imageSize.height,
            zoom,
            thresholdPx: 40,
          })
        : [],
    [
      annotationsVisible,
      imageSize.height,
      imageSize.width,
      model.preciseAnnotations,
      zoom,
    ]
  );
  const selectedGroup = groups.find(
    (group) => group.id === (activeGroupId ?? hoverGroupId)
  );
  const hasPanelContent = Boolean(
    model.resume ||
    model.indices.length > 0 ||
    model.panelExplanations.length > 0
  );
  const shouldShowAutoPanel =
    annotationsVisible && groups.length === 0 && hasPanelContent;

  useEffect(() => {
    setActiveGroupId(null);
    setHoverGroupId(null);
    setZoomIndex(0);
    setPanelOpen(false);
  }, [index, isOpen]);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;

    const updateImageSize = () => {
      if (image.clientWidth > 0 && image.clientHeight > 0) {
        setImageSize({ width: image.clientWidth, height: image.clientHeight });
      }
    };

    updateImageSize();
    if (typeof ResizeObserver === 'undefined') return;

    const resizeObserver = new ResizeObserver(updateImageSize);
    resizeObserver.observe(image);
    return () => resizeObserver.disconnect();
  }, [current?.src]);

  if (!isOpen || !current) return null;

  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;
  const showPanel = shouldShowAutoPanel || panelOpen;
  const activateAnnotation = (annotationId: string) => {
    const group = groups.find((item) =>
      item.annotations.some((annotation) => annotation.id === annotationId)
    );
    setActiveGroupId(group?.id ?? annotationId);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-2 backdrop-blur-sm sm:p-4">
      <dialog
        open
        aria-modal="true"
        aria-label={current.alt}
        className="relative flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-gray-950 text-white shadow-2xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-3">
          <div>
            <div className="font-semibold">{current.alt}</div>
            <div className="text-xs text-gray-300">
              {t('thermal.annotations.source')}: {current.source}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-sky-400"
              onClick={() => {
                setAnnotationsVisible((visible) => !visible);
                setActiveGroupId(null);
                setPanelOpen(false);
              }}
            >
              {annotationsVisible
                ? t('thermal.annotations.hideAnnotations')
                : t('thermal.annotations.showAnnotations')}
            </button>
            {hasPanelContent && annotationsVisible && !shouldShowAutoPanel && (
              <button
                type="button"
                className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-sky-400"
                onClick={() => setPanelOpen((open) => !open)}
              >
                {t('thermal.annotations.summaryAndMore')}
              </button>
            )}
            <button
              type="button"
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-sky-400"
              onClick={() =>
                setZoomIndex((value) =>
                  Math.min(value + 1, ZOOM_LEVELS.length - 1)
                )
              }
            >
              {t('thermal.annotations.zoomIn')}
            </button>
            <button
              type="button"
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-sky-400"
              onClick={() => {
                setZoomIndex(0);
                setActiveGroupId(null);
              }}
            >
              {t('thermal.annotations.reset')} ({zoom}x)
            </button>
            <button
              type="button"
              aria-label={t('common.close')}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-900 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
              onClick={onClose}
            >
              <span aria-hidden="true">x</span>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-gray-900 p-3">
          <div className="relative mx-auto w-max max-w-none">
            <div
              className="relative origin-top-left"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
              }}
            >
              <img
                ref={imageRef}
                src={current.src}
                alt={current.alt}
                className="max-h-[70vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
                onLoad={() => {
                  const image = imageRef.current;
                  if (image?.clientWidth && image.clientHeight) {
                    setImageSize({
                      width: image.clientWidth,
                      height: image.clientHeight,
                    });
                  }
                }}
              />
              {annotationsVisible &&
                model.preciseAnnotations
                  .filter((annotation) => annotation.type === 'zone')
                  .map((annotation) => (
                    <button
                      key={annotation.id}
                      type="button"
                      className={`absolute rounded-md border-2 transition focus:outline-none focus:ring-2 ${zoneClass[annotation.priority]}`}
                      style={{
                        left: `${annotation.x}%`,
                        top: `${annotation.y}%`,
                        width: `${annotation.width}%`,
                        height: `${annotation.height}%`,
                      }}
                      aria-label={annotation.label}
                      onClick={() => activateAnnotation(annotation.id)}
                    />
                  ))}
              {annotationsVisible &&
                groups.map((group) => (
                  <div
                    key={group.id}
                    className="absolute"
                    style={{
                      left: `${group.annotations[0].x}%`,
                      top: `${group.annotations[0].y}%`,
                      transform: `translate(-50%, -50%) scale(${1 / zoom})`,
                    }}
                    onMouseEnter={() => setHoverGroupId(group.id)}
                    onMouseLeave={() => setHoverGroupId(null)}
                  >
                    <button
                      type="button"
                      aria-label={
                        group.annotations.length > 1
                          ? t('thermal.annotations.groupLabel', {
                              count: group.annotations.length,
                            })
                          : group.annotations[0].label
                      }
                      className={`flex h-9 min-w-9 items-center justify-center rounded-full border-2 px-2 text-sm font-bold shadow-lg ring-4 transition hover:scale-105 focus:outline-none focus:ring-4 ${priorityClass[group.annotations[0].priority]}`}
                      onClick={() =>
                        setActiveGroupId((active) =>
                          active === group.id ? null : group.id
                        )
                      }
                    >
                      {group.annotations.length > 1
                        ? group.annotations.length
                        : 'i'}
                    </button>
                    {selectedGroup?.id === group.id && (
                      <div className="absolute left-1/2 top-11 hidden -translate-x-1/2 text-gray-900 sm:block dark:text-gray-100">
                        <GroupPopover group={group} />
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 p-3 text-xs text-gray-300">
          {annotationsVisible && groups.length > 0 && !selectedGroup && (
            <span>{t('thermal.annotations.help')}</span>
          )}
          {!annotationsVisible && (
            <span>{t('thermal.annotations.hidden')}</span>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 border-t border-white/10 p-3">
          {images.length > 1 && (
            <button
              type="button"
              disabled={!hasPrev}
              className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/20 disabled:cursor-default disabled:opacity-40"
              onClick={() => setIndex(index - 1)}
            >
              {t('thermal.annotations.previous')}
            </button>
          )}
          <span className="rounded-full bg-black/40 px-3 py-1 text-sm text-white">
            {current.alt}{' '}
            {images.length > 1 && `(${index + 1}/${images.length})`}
          </span>
          {images.length > 1 && (
            <button
              type="button"
              disabled={!hasNext}
              className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/20 disabled:cursor-default disabled:opacity-40"
              onClick={() => setIndex(index + 1)}
            >
              {t('thermal.annotations.next')}
            </button>
          )}
        </div>

        {selectedGroup && (
          <div className="fixed inset-x-0 bottom-0 z-[110] rounded-t-2xl bg-white p-4 text-gray-900 shadow-2xl sm:hidden dark:bg-gray-900 dark:text-gray-100">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="font-semibold">
                {selectedGroup.annotations.length > 1
                  ? t('thermal.annotations.groupLabel', {
                      count: selectedGroup.annotations.length,
                    })
                  : selectedGroup.annotations[0].label}
              </div>
              <button
                type="button"
                className="rounded-full bg-gray-100 px-3 py-1 text-sm dark:bg-gray-800"
                onClick={() => setActiveGroupId(null)}
              >
                {t('common.close')}
              </button>
            </div>
            <div className="max-h-[50vh] space-y-4 overflow-y-auto">
              {selectedGroup.annotations.map((annotation) => (
                <AnnotationText key={annotation.id} annotation={annotation} />
              ))}
            </div>
          </div>
        )}

        {showPanel && annotationsVisible && (
          <div className="absolute inset-x-3 bottom-20 z-[105] text-gray-900 sm:bottom-24 sm:left-auto sm:right-4 sm:w-[28rem] dark:text-gray-100">
            <ExplanationPanel
              title={t('thermal.annotations.summaryAndMore')}
              model={model}
            />
          </div>
        )}
      </dialog>
    </div>
  );
}
