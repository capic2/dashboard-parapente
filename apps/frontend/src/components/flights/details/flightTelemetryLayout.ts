import type { MetricKey } from './FlightTelemetryOverlay';

export type TelemetryIconName =
  | 'mountain'
  | 'wind'
  | 'heart'
  | 'compass'
  | 'map-pin'
  | 'flame'
  | 'gauge';

interface FlightTelemetryLayoutItemBase {
  id: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
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

export type FlightTelemetryLayoutItem =
  | FlightTelemetryWidgetLayout
  | FlightTelemetryIconLayout;

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
const ICONS: TelemetryIconName[] = [
  'mountain',
  'wind',
  'heart',
  'compass',
  'map-pin',
  'flame',
  'gauge',
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
    document.documentElement.querySelectorAll(':scope > widget, :scope > icon')
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
    const type = element.tagName === 'icon' ? 'icon' : 'widget';
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
    return type === 'icon'
      ? {
          ...common,
          ...grouping,
          ...naming,
          type: 'icon' as const,
          icon: ICONS.includes(
            element.getAttribute('name') as TelemetryIconName
          )
            ? (element.getAttribute('name') as TelemetryIconName)
            : 'gauge',
        }
      : {
          ...common,
          ...grouping,
          ...naming,
          type: 'widget' as const,
          metric: METRICS.includes(metric) ? metric : fallback.metric,
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
      const common = `id="${escapeXml(item.id)}"${name}${group} x="${item.x.toFixed(4)}" y="${item.y.toFixed(4)}" width="${item.width.toFixed(4)}" height="${item.height.toFixed(4)}" visible="${item.visible ? 'true' : 'false'}"`;
      return item.type === 'icon'
        ? `<icon ${common} name="${item.icon}" />`
        : `<widget ${common} metric="${item.metric}" />`;
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
