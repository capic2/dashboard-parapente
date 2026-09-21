import { METRIC_KEYS, type MetricKey } from './telemetryMetrics';

export type TelemetryIconName =
  | 'mountain'
  | 'wind'
  | 'heart'
  | 'heartbeat'
  | 'compass'
  | 'map-pin'
  | 'flame'
  | 'gauge'
  | 'slope'
  | 'slope-triangle';

interface FlightTelemetryLayoutItemBase {
  id: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  transparent?: boolean;
  border?: boolean;
  showLabel?: boolean;
  fontSize?: number;
  groupId?: string;
  groupName?: string;
}

export interface FlightTelemetryWidgetLayout extends FlightTelemetryLayoutItemBase {
  type: 'widget';
  metric: MetricKey;
}

export interface FlightTelemetryIconLayout extends FlightTelemetryLayoutItemBase {
  type: 'icon';
  icon: TelemetryIconName;
}

export interface FlightTelemetryTextLayout extends FlightTelemetryLayoutItemBase {
  type: 'text';
  content: string;
}

export type FlightTelemetryLayoutItem =
  | FlightTelemetryWidgetLayout
  | FlightTelemetryIconLayout
  | FlightTelemetryTextLayout;

export const DEFAULT_FLIGHT_TELEMETRY_LAYOUT = [
  {
    id: 'top-left',
    type: 'widget',
    metric: 'altitude',
    x: 0.02,
    y: 0.02,
    width: 0.16,
    height: 0.1,
    visible: true,
  },
  {
    id: 'top-right',
    type: 'widget',
    metric: 'speed',
    x: 0.82,
    y: 0.02,
    width: 0.16,
    height: 0.1,
    visible: true,
  },
  {
    id: 'bottom-left',
    type: 'widget',
    metric: 'vario',
    x: 0.02,
    y: 0.82,
    width: 0.16,
    height: 0.1,
    visible: true,
  },
  {
    id: 'bottom-right',
    type: 'widget',
    metric: 'distance',
    x: 0.82,
    y: 0.82,
    width: 0.16,
    height: 0.1,
    visible: true,
  },
] satisfies readonly FlightTelemetryWidgetLayout[];

const MAX_TELEMETRY_WIDGETS = 16;
const ICONS: TelemetryIconName[] = [
  'mountain',
  'wind',
  'heart',
  'heartbeat',
  'compass',
  'map-pin',
  'flame',
  'gauge',
  'slope',
  'slope-triangle',
];

function numberAttribute(element: Element, name: string, fallback: number) {
  const value = Number(element.getAttribute(name));
  return Number.isFinite(value) ? value : fallback;
}

export function parseTelemetryLayoutXml(
  xml: string
): FlightTelemetryLayoutItem[] {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (
    document.querySelector('parsererror') ||
    document.documentElement.tagName !== 'telemetry-layout'
  ) {
    return DEFAULT_FLIGHT_TELEMETRY_LAYOUT.map((widget) => ({ ...widget }));
  }
  const items = Array.from(
    document.documentElement.querySelectorAll(
      ':scope > widget, :scope > icon, :scope > text'
    )
  );
  const groupNames = new Map(
    Array.from(document.documentElement.querySelectorAll(':scope > group'))
      .map((group) => [group.getAttribute('id'), group.getAttribute('name')])
      .filter((entry): entry is [string, string] =>
        Boolean(entry[0] && entry[1])
      )
  );
  if (items.length < 1 || items.length > MAX_TELEMETRY_WIDGETS)
    return DEFAULT_FLIGHT_TELEMETRY_LAYOUT.map((widget) => ({ ...widget }));
  return items.map((element, index) => {
    const fallback =
      DEFAULT_FLIGHT_TELEMETRY_LAYOUT[
        index % DEFAULT_FLIGHT_TELEMETRY_LAYOUT.length
      ];
    const type = element.tagName;
    const metric = element.getAttribute('metric') as MetricKey;
    const common = {
      id: element.getAttribute('id') || fallback.id,
      x: numberAttribute(element, 'x', fallback.x),
      y: numberAttribute(element, 'y', fallback.y),
      width: numberAttribute(element, 'width', fallback.width),
      height: numberAttribute(element, 'height', fallback.height),
      visible: element.getAttribute('visible') !== 'false',
    };
    const groupId = element.getAttribute('group');
    const grouping = groupId
      ? {
          groupId,
          ...(groupNames.get(groupId)
            ? { groupName: groupNames.get(groupId) ?? undefined }
            : {}),
        }
      : {};
    const name = element.getAttribute('label');
    const naming = name ? { name } : {};
    const styling = {
      ...(element.getAttribute('background') === 'transparent'
        ? { transparent: true }
        : {}),
      ...(element.getAttribute('border') === 'false' ? { border: false } : {}),
      ...(element.getAttribute('label-visible') === 'false'
        ? { showLabel: false }
        : {}),
      ...(element.getAttribute('font-size') !== null &&
      Number.isFinite(Number(element.getAttribute('font-size')))
        ? { fontSize: Number(element.getAttribute('font-size')) }
        : {}),
    };
    if (type === 'icon') {
      return {
        ...common,
        ...grouping,
        ...naming,
        ...styling,
        type: 'icon' as const,
        icon: ICONS.includes(element.getAttribute('name') as TelemetryIconName)
          ? (element.getAttribute('name') as TelemetryIconName)
          : 'gauge',
      };
    }
    if (type === 'text') {
      return {
        ...common,
        ...grouping,
        ...naming,
        ...styling,
        type: 'text' as const,
        content: element.getAttribute('content') ?? '',
      };
    }
    return {
      ...common,
      ...grouping,
      ...naming,
      ...styling,
      type: 'widget' as const,
      metric: METRIC_KEYS.includes(metric) ? metric : fallback.metric,
    };
  });
}

export function serializeTelemetryLayoutXml(
  layout: readonly FlightTelemetryLayoutItem[]
) {
  const groups = Array.from(
    new Map(
      layout
        .filter((item) => item.groupId)
        .map((item) => [item.groupId as string, item.groupName] as const)
    )
  )
    .map(
      ([groupId, groupName]) =>
        `<group id="${escapeXml(groupId)}"${groupName ? ` name="${escapeXml(groupName)}"` : ''} />`
    )
    .join('');
  const root = `<telemetry-layout version="1" width="1920" height="1080">${groups}${layout
    .map((item) => {
      const name = item.name ? ` label="${escapeXml(item.name)}"` : '';
      const group = item.groupId ? ` group="${escapeXml(item.groupId)}"` : '';
      const background = item.transparent ? ' background="transparent"' : '';
      const border = item.border === false ? ' border="false"' : '';
      const labelVisibility =
        item.showLabel === false ? ' label-visible="false"' : '';
      const fontSize =
        item.type === 'widget' && item.fontSize !== undefined
          ? ` font-size="${item.fontSize}"`
          : '';
      const common = `id="${escapeXml(item.id)}"${name}${group}${background}${border}${labelVisibility}${fontSize} x="${item.x.toFixed(4)}" y="${item.y.toFixed(4)}" width="${item.width.toFixed(4)}" height="${item.height.toFixed(4)}" visible="${item.visible ? 'true' : 'false'}"`;
      if (item.type === 'icon') return `<icon ${common} name="${item.icon}" />`;
      if (item.type === 'text') {
        return `<text ${common} content="${escapeXml(item.content)}" />`;
      }
      return `<widget ${common} metric="${item.metric}" />`;
    })
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
