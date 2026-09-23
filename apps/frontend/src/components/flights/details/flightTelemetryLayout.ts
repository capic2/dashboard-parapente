import { METRIC_KEYS, type MetricKey } from './telemetryMetrics';

export type TelemetryInteractionAction = 'none' | 'cycle_metric';
export type TelemetryPipAction = 'switch_video';
export type TelemetryWidgetVariant =
  | 'value'
  | 'speedometer'
  | 'arc'
  | 'radial'
  | 'digital'
  | 'compass'
  | 'bar'
  | 'chart'
  | 'asi';
export type TelemetryValueAlignment = 'left' | 'center' | 'right';

export type TelemetryLayout = FlightTelemetryLayoutItem[] & {
  backgroundImage?: string;
};

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
  showUnit?: boolean;
  fontSize?: number;
  groupId?: string;
  groupName?: string;
}

export interface FlightTelemetryWidgetLayout extends FlightTelemetryLayoutItemBase {
  type: 'widget';
  metric: MetricKey;
  variant?: TelemetryWidgetVariant;
  valueAlign?: TelemetryValueAlignment;
  clickAction?: TelemetryInteractionAction;
  longPressAction?: TelemetryInteractionAction;
}

export interface FlightTelemetryIconLayout extends FlightTelemetryLayoutItemBase {
  type: 'icon';
  icon: TelemetryIconName;
}

export interface FlightTelemetryTextLayout extends FlightTelemetryLayoutItemBase {
  type: 'text';
  content: string;
}

export interface FlightTelemetryPipLayout extends FlightTelemetryLayoutItemBase {
  type: 'pip';
  action: TelemetryPipAction;
}

export type FlightTelemetryLayoutItem =
  | FlightTelemetryWidgetLayout
  | FlightTelemetryIconLayout
  | FlightTelemetryTextLayout
  | FlightTelemetryPipLayout;

export interface TelemetryLayoutGroupBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TelemetryAlignmentDirection =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'
  | 'row'
  | 'column';

function clampLayoutPosition(value: number, size: number) {
  return Math.max(0, Math.min(1 - size, value));
}

export function alignTelemetryLayoutItems(
  layout: readonly FlightTelemetryLayoutItem[],
  selectedIds: readonly string[],
  direction: TelemetryAlignmentDirection
): FlightTelemetryLayoutItem[] {
  const selectedItems = selectedIds
    .map((id) => layout.find((item) => item.id === id))
    .filter((item): item is FlightTelemetryLayoutItem => Boolean(item));
  if (!selectedItems.length) return [...layout];

  if (selectedItems.length === 1) {
    if (direction === 'row' || direction === 'column') return [...layout];

    const selectedItem = selectedItems[0];
    let x = selectedItem.x;
    let y = selectedItem.y;
    if (direction === 'left') x = 0;
    if (direction === 'center') x = (1 - selectedItem.width) / 2;
    if (direction === 'right') x = 1 - selectedItem.width;
    if (direction === 'top') y = 0;
    if (direction === 'middle') y = (1 - selectedItem.height) / 2;
    if (direction === 'bottom') y = 1 - selectedItem.height;

    return layout.map((item) =>
      item.id === selectedItem.id
        ? {
            ...item,
            x: clampLayoutPosition(x, item.width),
            y: clampLayoutPosition(y, item.height),
          }
        : item
    );
  }

  const left = Math.min(...selectedItems.map((item) => item.x));
  const top = Math.min(...selectedItems.map((item) => item.y));
  const right = Math.max(...selectedItems.map((item) => item.x + item.width));
  const bottom = Math.max(...selectedItems.map((item) => item.y + item.height));
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  const referenceX = selectedItems[0].x;
  const referenceY = selectedItems[0].y;

  return layout.map((item) => {
    if (!selectedIds.includes(item.id)) return item;
    if (direction === 'row') return { ...item, y: referenceY };
    if (direction === 'column') return { ...item, x: referenceX };
    if (direction === 'left') return { ...item, x: left };
    if (direction === 'center') {
      return {
        ...item,
        x: clampLayoutPosition(centerX - item.width / 2, item.width),
      };
    }
    if (direction === 'right') {
      return {
        ...item,
        x: clampLayoutPosition(right - item.width, item.width),
      };
    }
    if (direction === 'top') return { ...item, y: top };
    if (direction === 'middle') {
      return {
        ...item,
        y: clampLayoutPosition(centerY - item.height / 2, item.height),
      };
    }
    return {
      ...item,
      y: clampLayoutPosition(bottom - item.height, item.height),
    };
  });
}

export function getTelemetryLayoutGroupBounds(
  layout: readonly FlightTelemetryLayoutItem[],
  groupId: string
): TelemetryLayoutGroupBounds | null {
  const items = layout.filter((item) => item.groupId === groupId);
  if (!items.length) return null;
  const left = Math.min(...items.map((item) => item.x));
  const top = Math.min(...items.map((item) => item.y));
  const right = Math.max(...items.map((item) => item.x + item.width));
  const bottom = Math.max(...items.map((item) => item.y + item.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

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
const INTERACTION_ACTIONS: TelemetryInteractionAction[] = [
  'none',
  'cycle_metric',
];
const PIP_ACTIONS: TelemetryPipAction[] = ['switch_video'];
const WIDGET_VARIANTS: TelemetryWidgetVariant[] = [
  'value',
  'speedometer',
  'arc',
  'radial',
  'digital',
  'compass',
  'bar',
  'chart',
  'asi',
];
const VALUE_ALIGNMENTS: TelemetryValueAlignment[] = ['left', 'center', 'right'];

function numberAttribute(element: Element, name: string, fallback: number) {
  const value = Number(element.getAttribute(name));
  return Number.isFinite(value) ? value : fallback;
}

export function parseTelemetryLayoutXml(xml: string): TelemetryLayout {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (
    document.querySelector('parsererror') ||
    document.documentElement.tagName !== 'telemetry-layout'
  ) {
    return withBackground(
      DEFAULT_FLIGHT_TELEMETRY_LAYOUT.map((widget) => ({ ...widget }))
    );
  }
  const items = Array.from(
    document.documentElement.querySelectorAll(
      ':scope > widget, :scope > icon, :scope > text, :scope > pip'
    )
  );
  const groupNames = new Map(
    Array.from(document.documentElement.querySelectorAll(':scope > group'))
      .map((group) => [group.getAttribute('id'), group.getAttribute('name')])
      .filter((entry): entry is [string, string] =>
        Boolean(entry[0] && entry[1])
      )
  );
  if (items.length < 1)
    return withBackground(
      DEFAULT_FLIGHT_TELEMETRY_LAYOUT.map((widget) => ({ ...widget }))
    );
  const parsed = items.map((element, index) => {
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
    const backgroundAttribute = element.getAttribute('background');
    const borderAttribute = element.getAttribute('border');
    const styling = {
      ...(backgroundAttribute === 'transparent'
        ? { transparent: true }
        : backgroundAttribute === 'solid'
          ? { transparent: false }
          : {}),
      ...(borderAttribute === 'true'
        ? { border: true }
        : borderAttribute === 'false'
          ? { border: false }
          : {}),
      ...(element.getAttribute('label-visible') === 'false'
        ? { showLabel: false }
        : {}),
      ...(type === 'widget' && element.getAttribute('unit-visible') === 'false'
        ? { showUnit: false }
        : {}),
      ...(element.getAttribute('font-size') !== null &&
      Number.isFinite(Number(element.getAttribute('font-size')))
        ? { fontSize: Number(element.getAttribute('font-size')) }
        : {}),
    };
    const interactions =
      type === 'widget'
        ? {
            ...(INTERACTION_ACTIONS.includes(
              element.getAttribute('click-action') as TelemetryInteractionAction
            )
              ? {
                  clickAction: element.getAttribute(
                    'click-action'
                  ) as TelemetryInteractionAction,
                }
              : {}),
            ...(INTERACTION_ACTIONS.includes(
              element.getAttribute(
                'long-press-action'
              ) as TelemetryInteractionAction
            )
              ? {
                  longPressAction: element.getAttribute(
                    'long-press-action'
                  ) as TelemetryInteractionAction,
                }
              : {}),
          }
        : {};
    const variant =
      type === 'widget' &&
      WIDGET_VARIANTS.includes(
        element.getAttribute('variant') as TelemetryWidgetVariant
      )
        ? { variant: element.getAttribute('variant') as TelemetryWidgetVariant }
        : {};
    const valueAlign =
      type === 'widget' &&
      VALUE_ALIGNMENTS.includes(
        element.getAttribute('align') as TelemetryValueAlignment
      )
        ? {
            valueAlign: element.getAttribute(
              'align'
            ) as TelemetryValueAlignment,
          }
        : {};
    if (type === 'icon') {
      return {
        ...common,
        ...grouping,
        ...naming,
        ...styling,
        ...interactions,
        ...variant,
        ...valueAlign,
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
        ...interactions,
        ...variant,
        ...valueAlign,
        type: 'text' as const,
        content: element.getAttribute('content') ?? '',
      };
    }
    if (type === 'pip') {
      return {
        ...common,
        ...grouping,
        ...naming,
        ...styling,
        type: 'pip' as const,
        action: PIP_ACTIONS.includes(
          element.getAttribute('action') as TelemetryPipAction
        )
          ? (element.getAttribute('action') as TelemetryPipAction)
          : 'switch_video',
      };
    }
    return {
      ...common,
      ...grouping,
      ...naming,
      ...styling,
      ...interactions,
      ...variant,
      ...valueAlign,
      type: 'widget' as const,
      metric: METRIC_KEYS.includes(metric) ? metric : fallback.metric,
    };
  });
  return withBackground(
    parsed,
    document.documentElement.getAttribute('background-image') ?? undefined
  );
}

export function serializeTelemetryLayoutXml(
  layout: readonly FlightTelemetryLayoutItem[],
  options?: { backgroundImage?: string }
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
  const backgroundImage = options
    ? options.backgroundImage
    : (layout as TelemetryLayout).backgroundImage;
  const background = backgroundImage
    ? ` background-image="${escapeXml(backgroundImage)}"`
    : '';
  const root = `<telemetry-layout version="1" width="1920" height="1080"${background}>${groups}${layout
    .map((item) => {
      const name = item.name ? ` label="${escapeXml(item.name)}"` : '';
      const group = item.groupId ? ` group="${escapeXml(item.groupId)}"` : '';
      const background =
        item.transparent === true
          ? ' background="transparent"'
          : item.transparent === false
            ? ' background="solid"'
            : '';
      const border =
        item.border === true
          ? ' border="true"'
          : item.border === false
            ? ' border="false"'
            : '';
      const labelVisibility =
        item.showLabel === false ? ' label-visible="false"' : '';
      const unitVisibility =
        item.type === 'widget' && item.showUnit === false
          ? ' unit-visible="false"'
          : '';
      const fontSize =
        item.type !== 'icon' && item.fontSize !== undefined
          ? ` font-size="${item.fontSize}"`
          : '';
      const clickAction =
        item.type === 'widget' && item.clickAction
          ? ` click-action="${item.clickAction}"`
          : '';
      const longPressAction =
        item.type === 'widget' && item.longPressAction
          ? ` long-press-action="${item.longPressAction}"`
          : '';
      const variant =
        item.type === 'widget' && item.variant
          ? ` variant="${item.variant}"`
          : '';
      const valueAlign =
        item.type === 'widget' && item.valueAlign
          ? ` align="${item.valueAlign}"`
          : '';
      const pipAction = item.type === 'pip' ? ` action="${item.action}"` : '';
      const common = `id="${escapeXml(item.id)}"${name}${group}${background}${border}${labelVisibility}${unitVisibility}${fontSize}${clickAction}${longPressAction}${variant}${valueAlign} x="${item.x.toFixed(4)}" y="${item.y.toFixed(4)}" width="${item.width.toFixed(4)}" height="${item.height.toFixed(4)}" visible="${item.visible ? 'true' : 'false'}"`;
      if (item.type === 'icon') return `<icon ${common} name="${item.icon}" />`;
      if (item.type === 'text') {
        return `<text ${common} content="${escapeXml(item.content)}" />`;
      }
      if (item.type === 'pip') return `<pip ${common}${pipAction} />`;
      return `<widget ${common} metric="${item.metric}" />`;
    })
    .join('')}</telemetry-layout>`;
  return new XMLSerializer().serializeToString(
    new DOMParser().parseFromString(root, 'application/xml')
  );
}

function withBackground(
  items: FlightTelemetryLayoutItem[],
  backgroundImage?: string
): TelemetryLayout {
  Object.defineProperty(items, 'backgroundImage', {
    value: backgroundImage,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  return items as TelemetryLayout;
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
