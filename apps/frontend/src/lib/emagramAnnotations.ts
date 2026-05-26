export type EmagramAnnotationType = 'point' | 'zone';
export type EmagramAnnotationPriority = 'important' | 'watch' | 'educational';
export type EmagramAnnotationCategory =
  | 'thermal'
  | 'ceiling'
  | 'stability'
  | 'humidity'
  | 'wind'
  | 'risk';

export interface EmagramImageAnnotation {
  id: string;
  source: string;
  type: EmagramAnnotationType;
  label: string;
  priority: EmagramAnnotationPriority;
  category: EmagramAnnotationCategory;
  displayOrder: number;
  confidence: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  visualCue: string;
  weatherReading: string;
  flightImpact: string;
  term?: string;
  termDefinition?: string;
  uncertaintyNote?: string;
}

export interface EmagramPanelExplanation {
  id: string;
  source: string;
  label: string;
  confidence?: number;
  reason?: string;
  visualCue?: string;
  weatherReading?: string;
  flightImpact?: string;
  term?: string;
  termDefinition?: string;
  text?: string;
}

export interface EmagramAnnotationModel {
  locale: string | null;
  resume: string | null;
  indices: string[];
  preciseAnnotations: EmagramImageAnnotation[];
  panelExplanations: EmagramPanelExplanation[];
}

export interface EmagramAnnotationGroup {
  id: string;
  x: number;
  y: number;
  annotations: EmagramImageAnnotation[];
}

const VALID_PRIORITIES = ['important', 'watch', 'educational'] as const;
const VALID_CATEGORIES = [
  'thermal',
  'ceiling',
  'stability',
  'humidity',
  'wind',
  'risk',
] as const;
const VALID_TYPES = ['point', 'zone'] as const;
const MIN_CONFIDENCE = 0.7;
const MAX_VISIBLE_ANNOTATIONS = 6;
const MAX_ZONE_SIZE = 40;
const MAX_ZONE_AREA = 900;

const PRIORITY_ORDER: Record<EmagramAnnotationPriority, number> = {
  important: 0,
  watch: 1,
  educational: 2,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function asNumber(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value;
}

function inPercentRange(value: unknown): value is number {
  const numberValue = asNumber(value);
  return numberValue !== null && numberValue >= 0 && numberValue <= 100;
}

function isValidPriority(value: unknown): value is EmagramAnnotationPriority {
  return VALID_PRIORITIES.includes(value as EmagramAnnotationPriority);
}

function isValidCategory(value: unknown): value is EmagramAnnotationCategory {
  return VALID_CATEGORIES.includes(value as EmagramAnnotationCategory);
}

function isValidType(value: unknown): value is EmagramAnnotationType {
  return VALID_TYPES.includes(value as EmagramAnnotationType);
}

function panelTextKey(explanation: EmagramPanelExplanation): string {
  return [
    explanation.visualCue,
    explanation.weatherReading,
    explanation.flightImpact,
    explanation.text,
  ]
    .filter(Boolean)
    .join('|')
    .trim();
}

function hasUsefulExplanation(annotation: EmagramPanelExplanation): boolean {
  return Boolean(panelTextKey(annotation));
}

function sortAnnotations<
  T extends {
    priority?: EmagramAnnotationPriority;
    displayOrder?: number;
    confidence?: number;
  },
>(annotations: T[]): T[] {
  return [...annotations].sort((a, b) => {
    const priorityA = a.priority ? PRIORITY_ORDER[a.priority] : 99;
    const priorityB = b.priority ? PRIORITY_ORDER[b.priority] : 99;
    if (priorityA !== priorityB) return priorityA - priorityB;
    const orderA = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });
}

function toPanelExplanation(
  source: string,
  raw: Record<string, unknown>,
  reason: string
): EmagramPanelExplanation | null {
  const explanation: EmagramPanelExplanation = {
    id: isString(raw.id) ? raw.id : `${source}-panel-${reason}`,
    source,
    label: isString(raw.label) ? raw.label : source,
    confidence: asNumber(raw.confidence) ?? undefined,
    reason,
    visualCue: isString(raw.visual_cue) ? raw.visual_cue : undefined,
    weatherReading: isString(raw.weather_reading)
      ? raw.weather_reading
      : undefined,
    flightImpact: isString(raw.flight_impact) ? raw.flight_impact : undefined,
    term: isString(raw.term) ? raw.term : undefined,
    termDefinition: isString(raw.term_definition)
      ? raw.term_definition
      : undefined,
  };
  return hasUsefulExplanation(explanation) ? explanation : null;
}

function parseSingleAnnotation(
  source: string,
  raw: unknown
): {
  precise?: EmagramImageAnnotation;
  panel?: EmagramPanelExplanation;
} | null {
  if (!isObject(raw)) return null;
  const type = raw.type;
  const priority = raw.priority;
  const category = raw.category;
  const confidence = asNumber(raw.confidence);

  if (
    !isValidType(type) ||
    !isValidPriority(priority) ||
    !isValidCategory(category)
  ) {
    const panel = toPanelExplanation(source, raw, 'invalid_metadata');
    return panel ? { panel } : null;
  }

  if (confidence === null) {
    const panel = toPanelExplanation(source, raw, 'missing_confidence');
    return panel ? { panel } : null;
  }

  if (!inPercentRange(raw.x) || !inPercentRange(raw.y)) {
    const panel = toPanelExplanation(source, raw, 'invalid_coordinates');
    return panel ? { panel } : null;
  }

  const width = asNumber(raw.width);
  const height = asNumber(raw.height);
  if (type === 'zone') {
    const hasInvalidZone =
      width === null ||
      height === null ||
      width < 0 ||
      width > 100 ||
      height < 0 ||
      height > 100 ||
      width > MAX_ZONE_SIZE ||
      height > MAX_ZONE_SIZE ||
      width * height > MAX_ZONE_AREA;
    if (hasInvalidZone) {
      const panel = toPanelExplanation(source, raw, 'invalid_zone');
      return panel ? { panel } : null;
    }
  }

  if (confidence < MIN_CONFIDENCE) {
    const panel = toPanelExplanation(source, raw, 'low_confidence');
    return panel ? { panel } : null;
  }

  if (!isString(raw.label) || !isString(raw.visual_cue)) {
    const panel = toPanelExplanation(source, raw, 'missing_text');
    return panel ? { panel } : null;
  }

  if (!isString(raw.weather_reading) || !isString(raw.flight_impact)) {
    const panel = toPanelExplanation(source, raw, 'missing_text');
    return panel ? { panel } : null;
  }

  const precise: EmagramImageAnnotation = {
    id: isString(raw.id) ? raw.id : `${source}-${raw.label}`,
    source,
    type,
    label: raw.label,
    priority,
    category,
    displayOrder: asNumber(raw.display_order) ?? Number.MAX_SAFE_INTEGER,
    confidence,
    x: raw.x,
    y: raw.y,
    width: type === 'zone' ? (width ?? undefined) : undefined,
    height: type === 'zone' ? (height ?? undefined) : undefined,
    visualCue: raw.visual_cue,
    weatherReading: raw.weather_reading,
    flightImpact: raw.flight_impact,
    term: isString(raw.term) ? raw.term : undefined,
    termDefinition: isString(raw.term_definition)
      ? raw.term_definition
      : undefined,
    uncertaintyNote: isString(raw.uncertainty_note)
      ? raw.uncertainty_note
      : undefined,
  };

  return { precise };
}

function parseLegacyObservations(
  source: string,
  rawExplanation: Record<string, unknown>
): EmagramPanelExplanation[] {
  const parSource = rawExplanation.par_source;
  if (!isObject(parSource)) return [];
  const observations = parSource[source];
  const values = Array.isArray(observations)
    ? observations
    : isString(observations)
      ? [observations]
      : [];
  return values.filter(isString).map((text, index) => ({
    id: `${source}-legacy-${index}`,
    source,
    label: source,
    text,
  }));
}

function dedupePanelExplanations(
  explanations: EmagramPanelExplanation[]
): EmagramPanelExplanation[] {
  const seen = new Set<string>();
  return explanations.filter((explanation) => {
    const key = panelTextKey(explanation);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseEmagramAnnotationModel(
  aiRawResponse: string | null | undefined,
  source: string
): EmagramAnnotationModel {
  if (!aiRawResponse) {
    return {
      locale: null,
      resume: null,
      indices: [],
      preciseAnnotations: [],
      panelExplanations: [],
    };
  }

  try {
    const parsed = JSON.parse(aiRawResponse);
    const rawExplanation =
      parsed?.explication_analyse ?? parsed?.details_analyse;
    if (!isObject(rawExplanation)) {
      return {
        locale: null,
        resume: isString(rawExplanation) ? rawExplanation : null,
        indices: [],
        preciseAnnotations: [],
        panelExplanations: [],
      };
    }

    const annotationsBySource = rawExplanation.annotations_image;
    const rawSourceAnnotations = isObject(annotationsBySource)
      ? annotationsBySource[source]
      : [];
    const rawAnnotations = Array.isArray(rawSourceAnnotations)
      ? rawSourceAnnotations
      : [];

    const preciseAnnotations: EmagramImageAnnotation[] = [];
    const panelExplanations: EmagramPanelExplanation[] = [];

    for (const raw of rawAnnotations) {
      const parsedAnnotation = parseSingleAnnotation(source, raw);
      if (parsedAnnotation?.precise)
        preciseAnnotations.push(parsedAnnotation.precise);
      if (parsedAnnotation?.panel)
        panelExplanations.push(parsedAnnotation.panel);
    }

    const sortedPrecise = sortAnnotations(preciseAnnotations);
    const visiblePrecise = sortedPrecise.slice(0, MAX_VISIBLE_ANNOTATIONS);
    const overflowPanel = sortedPrecise
      .slice(MAX_VISIBLE_ANNOTATIONS)
      .map((annotation) => ({
        id: `${annotation.id}-overflow`,
        source,
        label: annotation.label,
        confidence: annotation.confidence,
        reason: 'overflow',
        visualCue: annotation.visualCue,
        weatherReading: annotation.weatherReading,
        flightImpact: annotation.flightImpact,
        term: annotation.term,
        termDefinition: annotation.termDefinition,
      }));

    const indices = Array.isArray(rawExplanation.indices)
      ? rawExplanation.indices.filter(isString)
      : [];

    return {
      locale: isString(rawExplanation.locale) ? rawExplanation.locale : null,
      resume: isString(rawExplanation.resume) ? rawExplanation.resume : null,
      indices,
      preciseAnnotations: visiblePrecise,
      panelExplanations: dedupePanelExplanations([
        ...panelExplanations,
        ...overflowPanel,
        ...parseLegacyObservations(source, rawExplanation),
      ]),
    };
  } catch {
    return {
      locale: null,
      resume: null,
      indices: [],
      preciseAnnotations: [],
      panelExplanations: [],
    };
  }
}

export function formatConfidence(
  confidence: number | undefined
): string | null {
  if (confidence === undefined || Number.isNaN(confidence)) return null;
  return `${Math.round(confidence * 100)} %`;
}

export function groupEmagramAnnotations(
  annotations: EmagramImageAnnotation[],
  options: {
    imageWidth: number;
    imageHeight: number;
    zoom: number;
    thresholdPx: number;
  }
): EmagramAnnotationGroup[] {
  const groups: EmagramAnnotationGroup[] = [];
  for (const annotation of sortAnnotations(annotations)) {
    const x = (annotation.x / 100) * options.imageWidth * options.zoom;
    const y = (annotation.y / 100) * options.imageHeight * options.zoom;
    const existing = groups.find((group) => {
      const dx = group.x - x;
      const dy = group.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= options.thresholdPx;
    });
    if (existing) {
      existing.annotations = sortAnnotations([
        ...existing.annotations,
        annotation,
      ]);
    } else {
      groups.push({ id: annotation.id, x, y, annotations: [annotation] });
    }
  }
  return groups;
}
