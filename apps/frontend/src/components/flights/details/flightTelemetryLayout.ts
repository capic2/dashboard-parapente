import type { MetricKey } from './FlightTelemetryOverlay';

export interface FlightTelemetryWidgetLayout {
  id: string;
  metric: MetricKey;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

export const DEFAULT_FLIGHT_TELEMETRY_LAYOUT = [
  {
    id: 'top-left',
    metric: 'altitude',
    x: 0.02,
    y: 0.02,
    width: 0.16,
    height: 0.1,
    visible: true,
  },
  {
    id: 'top-right',
    metric: 'speed',
    x: 0.82,
    y: 0.02,
    width: 0.16,
    height: 0.1,
    visible: true,
  },
  {
    id: 'bottom-left',
    metric: 'vario',
    x: 0.02,
    y: 0.82,
    width: 0.16,
    height: 0.1,
    visible: true,
  },
  {
    id: 'bottom-right',
    metric: 'distance',
    x: 0.82,
    y: 0.82,
    width: 0.16,
    height: 0.1,
    visible: true,
  },
] satisfies readonly FlightTelemetryWidgetLayout[];

const METRICS: MetricKey[] = [
  'altitude',
  'speed',
  'vario',
  'distance',
  'heading',
  'heart_rate',
  'power',
];
const MAX_TELEMETRY_WIDGETS = 16;

function numberAttribute(element: Element, name: string, fallback: number) {
  const value = Number(element.getAttribute(name));
  return Number.isFinite(value) ? value : fallback;
}

export function parseTelemetryLayoutXml(
  xml: string
): FlightTelemetryWidgetLayout[] {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (
    document.querySelector('parsererror') ||
    document.documentElement.tagName !== 'telemetry-layout'
  ) {
    return DEFAULT_FLIGHT_TELEMETRY_LAYOUT.map((widget) => ({ ...widget }));
  }
  const widgets = Array.from(
    document.documentElement.querySelectorAll(':scope > widget')
  );
  if (widgets.length < 1 || widgets.length > MAX_TELEMETRY_WIDGETS)
    return DEFAULT_FLIGHT_TELEMETRY_LAYOUT.map((widget) => ({ ...widget }));
  return widgets.map((element, index) => {
    const fallback =
      DEFAULT_FLIGHT_TELEMETRY_LAYOUT[
        index % DEFAULT_FLIGHT_TELEMETRY_LAYOUT.length
      ];
    const metric = element.getAttribute('metric') as MetricKey;
    return {
      id: element.getAttribute('id') || fallback.id,
      metric: METRICS.includes(metric) ? metric : fallback.metric,
      x: numberAttribute(element, 'x', fallback.x),
      y: numberAttribute(element, 'y', fallback.y),
      width: numberAttribute(element, 'width', fallback.width),
      height: numberAttribute(element, 'height', fallback.height),
      visible: element.getAttribute('visible') !== 'false',
    };
  });
}

export function serializeTelemetryLayoutXml(
  layout: readonly FlightTelemetryWidgetLayout[]
) {
  const root = `<telemetry-layout version="1" width="1920" height="1080">${layout
    .map(
      (widget) =>
        `<widget id="${escapeXml(widget.id)}" metric="${widget.metric}" x="${widget.x.toFixed(4)}" y="${widget.y.toFixed(4)}" width="${widget.width.toFixed(4)}" height="${widget.height.toFixed(4)}" visible="${widget.visible ? 'true' : 'false'}" />`
    )
    .join('')}</telemetry-layout>`;
  return new XMLSerializer().serializeToString(
    new DOMParser().parseFromString(root, 'application/xml')
  );
}

function escapeXml(value: string) {
  return value.replace(
    /[<>&']/g,
    (character) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;',
      })[character] ?? character
  );
}
