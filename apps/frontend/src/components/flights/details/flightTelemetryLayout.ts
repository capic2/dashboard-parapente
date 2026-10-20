import { METRIC_KEYS, type MetricKey } from './telemetryMetrics';

export type TelemetryInteractionAction = 'none' | 'cycle_metric';
export type TelemetryPipAction = 'switch_video';
export type TelemetryPipVideoRole = 'face' | 'pilote' | 'vol';
export type TelemetryPipVideoSource =
  | `youtube:${TelemetryPipVideoRole}`
  | `file:${TelemetryPipVideoRole}`;
export type TelemetryMainVideoSource = 'auto' | TelemetryPipVideoSource;
export const TELEMETRY_PIP_VIDEO_SOURCES: TelemetryPipVideoSource[] = [
  'youtube:face',
  'youtube:pilote',
  'youtube:vol',
  'file:face',
  'file:pilote',
  'file:vol',
];
export const DEFAULT_TELEMETRY_PIP_VIDEO_SOURCE: TelemetryPipVideoSource =
  'file:vol';

export function getYoutubePipVideoRole(
  source?: TelemetryPipVideoSource
): TelemetryPipVideoRole | undefined {
  if (!source?.startsWith('youtube:')) return undefined;
  return source.slice('youtube:'.length) as TelemetryPipVideoRole;
}

export function getYoutubeVideoRoleFromTitle(
  title?: string | null
): TelemetryPipVideoRole | undefined {
  const match = title?.trim().match(/[-–—]\s*(face|pilote|vol)$/iu);
  return match?.[1]?.toLowerCase() as TelemetryPipVideoRole | undefined;
}
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
  mainVideoSource?: TelemetryMainVideoSource;
};

export const TELEMETRY_CANVAS_WIDTH = 1920;
export const TELEMETRY_CANVAS_HEIGHT = 1080;

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
  /** Coordinates in the logical 1920x1080 canvas, expressed in pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  transparent?: boolean;
  backgroundColor?: string;
  backgroundOpacity?: number;
  border?: boolean;
  showLabel?: boolean;
  showUnit?: boolean;
  fontSize?: number;
  groupId?: string;
  groupName?: string;
  parentGroupId?: string;
  parentGroupName?: string;
  parentGroupBackgroundColor?: string;
  parentGroupBackgroundOpacity?: number;
  parentGroupBorderRadius?: number;
  groupBackgroundColor?: string;
  groupBackgroundOpacity?: number;
  groupBorderRadius?: number;
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
  textAlign?: TelemetryValueAlignment;
}

export interface FlightTelemetryPipLayout extends FlightTelemetryLayoutItemBase {
  type: 'pip';
  action: TelemetryPipAction;
  source?: TelemetryPipVideoSource;
  applyOffset?: boolean;
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

export function groupTelemetryLayoutSelection(
  layout: readonly FlightTelemetryLayoutItem[],
  selectedIds: readonly string[],
  newGroupId: string,
  newGroupName: string
): FlightTelemetryLayoutItem[] {
  if (selectedIds.length < 2) return [...layout];

  const selectedIdSet = new Set(selectedIds);
  const selectedItems = layout.filter((item) => selectedIdSet.has(item.id));
  const existingGroupIds = new Set(
    selectedItems
      .map((item) => item.groupId)
      .filter((groupId): groupId is string => Boolean(groupId))
  );
  const completeGroupIds = new Set(
    [...existingGroupIds].filter((groupId) =>
      layout
        .filter((item) => item.groupId === groupId)
        .every((item) => selectedIdSet.has(item.id))
    )
  );
  const incompleteGroupIds = [...existingGroupIds].filter(
    (groupId) => !completeGroupIds.has(groupId)
  );

  if (
    selectedItems.every((item) => item.groupId) &&
    completeGroupIds.size > 0 &&
    incompleteGroupIds.length === 1
  ) {
    const selectedGroupContainsNestedGroups = layout.some(
      (item) => item.parentGroupId && completeGroupIds.has(item.parentGroupId)
    );
    if (selectedGroupContainsNestedGroups) return [...layout];

    const targetGroupId = incompleteGroupIds[0];
    const targetGroup = layout.find((item) => item.groupId === targetGroupId);
    if (targetGroup && !targetGroup.parentGroupId) {
      return layout.map((item) =>
        selectedIdSet.has(item.id) &&
        item.groupId &&
        completeGroupIds.has(item.groupId)
          ? {
              ...item,
              parentGroupId: targetGroupId,
              parentGroupName: targetGroup.groupName ?? targetGroupId,
            }
          : item
      );
    }
  }

  const parentGroupIds = new Set(
    selectedItems.map((item) => item.parentGroupId)
  );
  const canCreateParentGroup =
    completeGroupIds.size >= 2 &&
    incompleteGroupIds.length === 0 &&
    parentGroupIds.size === 1 &&
    selectedItems.every((item) => item.groupId) &&
    selectedItems.every((item) => !item.parentGroupId);

  if (canCreateParentGroup) {
    return layout.map((item) => {
      if (!selectedIdSet.has(item.id)) return item;
      if (item.groupId) {
        return {
          ...item,
          parentGroupId: newGroupId,
          parentGroupName: newGroupName,
        };
      }
      return item;
    });
  }

  const existingGroupId =
    existingGroupIds.size === 1 ? [...existingGroupIds][0] : undefined;
  const existingGroupItem = existingGroupId
    ? layout.find((item) => item.groupId === existingGroupId)
    : undefined;
  const existingGroupName = existingGroupItem?.groupName;
  return layout.map((item) => {
    if (!selectedIdSet.has(item.id)) return item;
    return {
      ...item,
      groupId: existingGroupId ?? newGroupId,
      groupName: existingGroupName ?? newGroupName,
      ...(existingGroupItem
        ? {
            parentGroupId: existingGroupItem.parentGroupId,
            parentGroupName: existingGroupItem.parentGroupName,
            parentGroupBackgroundColor:
              existingGroupItem.parentGroupBackgroundColor,
            parentGroupBackgroundOpacity:
              existingGroupItem.parentGroupBackgroundOpacity,
            parentGroupBorderRadius: existingGroupItem.parentGroupBorderRadius,
          }
        : parentGroupIds.size === 1
          ? {}
          : {
              parentGroupId: undefined,
              parentGroupName: undefined,
              parentGroupBackgroundColor: undefined,
              parentGroupBackgroundOpacity: undefined,
              parentGroupBorderRadius: undefined,
            }),
    };
  });
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
  return Math.max(0, Math.min(TELEMETRY_CANVAS_WIDTH - size, value));
}

function clampLayoutVerticalPosition(value: number, size: number) {
  return Math.max(0, Math.min(TELEMETRY_CANVAS_HEIGHT - size, value));
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

  if (selectedItems.length < 2) return [...layout];

  const reference = selectedItems[0];
  const referenceRight = reference.x + reference.width;
  const referenceBottom = reference.y + reference.height;
  const referenceCenterX = reference.x + reference.width / 2;
  const referenceCenterY = reference.y + reference.height / 2;

  return layout.map((item) => {
    if (!selectedIds.includes(item.id)) return item;
    if (direction === 'row') return { ...item, y: reference.y };
    if (direction === 'column') return { ...item, x: reference.x };
    if (direction === 'left') return { ...item, x: reference.x };
    if (direction === 'center') {
      return {
        ...item,
        x: clampLayoutPosition(referenceCenterX - item.width / 2, item.width),
      };
    }
    if (direction === 'right') {
      return {
        ...item,
        x: clampLayoutPosition(referenceRight - item.width, item.width),
      };
    }
    if (direction === 'top') return { ...item, y: reference.y };
    if (direction === 'middle') {
      return {
        ...item,
        y: clampLayoutVerticalPosition(
          referenceCenterY - item.height / 2,
          item.height
        ),
      };
    }
    return {
      ...item,
      y: clampLayoutVerticalPosition(
        referenceBottom - item.height,
        item.height
      ),
    };
  });
}

export function getTelemetryLayoutGroupBounds(
  layout: readonly FlightTelemetryLayoutItem[],
  groupId: string
): TelemetryLayoutGroupBounds | null {
  const items = layout.filter(
    (item) => item.groupId === groupId || item.parentGroupId === groupId
  );
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
    x: 38.4,
    y: 21.6,
    width: 307.2,
    height: 108,
    visible: true,
  },
  {
    id: 'top-right',
    type: 'widget',
    metric: 'speed',
    x: 1574.4,
    y: 21.6,
    width: 307.2,
    height: 108,
    visible: true,
  },
  {
    id: 'heart-rate',
    type: 'widget',
    metric: 'heart_rate',
    x: 38.4,
    y: 151.2,
    width: 307.2,
    height: 108,
    visible: true,
  },
  {
    id: 'total-gain',
    type: 'widget',
    metric: 'climb_from_takeoff',
    x: 1574.4,
    y: 151.2,
    width: 307.2,
    height: 108,
    visible: true,
  },
  {
    id: 'total-loss',
    type: 'widget',
    metric: 'descent_from_takeoff',
    x: 1574.4,
    y: 280.8,
    width: 307.2,
    height: 108,
    visible: true,
  },
  {
    id: 'bottom-left',
    type: 'widget',
    metric: 'vario',
    x: 38.4,
    y: 885.6,
    width: 307.2,
    height: 108,
    visible: true,
  },
  {
    id: 'bottom-right',
    type: 'widget',
    metric: 'distance',
    x: 1574.4,
    y: 885.6,
    width: 307.2,
    height: 108,
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

function normalizedToCanvasPixels(value: number, canvasSize: number) {
  return Number((value * canvasSize).toFixed(4));
}

export function parseTelemetryLayoutXml(xml: string): TelemetryLayout {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (
    document.querySelector('parsererror') ||
    document.documentElement.tagName !== 'telemetry-layout'
  ) {
    return withLayoutMetadata(
      DEFAULT_FLIGHT_TELEMETRY_LAYOUT.map((widget) => ({ ...widget }))
    );
  }
  const items = Array.from(
    document.documentElement.querySelectorAll(
      ':scope > widget, :scope > icon, :scope > text, :scope > pip'
    )
  );
  const groupNames = new Map<
    string,
    {
      name?: string;
      parentId?: string;
      backgroundColor?: string;
      backgroundOpacity?: number;
      borderRadius?: number;
    }
  >();
  for (const group of document.documentElement.querySelectorAll(
    ':scope > group'
  )) {
    const id = group.getAttribute('id');
    if (!id) continue;
    const rawBackgroundColor = group.getAttribute('background-color');
    groupNames.set(id, {
      name: group.getAttribute('name') ?? undefined,
      parentId: group.getAttribute('parent') ?? undefined,
      backgroundColor:
        rawBackgroundColor && /^#[\da-f]{6}$/iu.test(rawBackgroundColor)
          ? rawBackgroundColor
          : undefined,
      backgroundOpacity: group.hasAttribute('background-opacity')
        ? Math.max(
            0,
            Math.min(1, numberAttribute(group, 'background-opacity', 1))
          )
        : undefined,
      borderRadius: group.hasAttribute('border-radius')
        ? Math.max(
            0,
            Math.min(120, numberAttribute(group, 'border-radius', 12))
          )
        : undefined,
    });
  }
  if (items.length < 1)
    return withLayoutMetadata(
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
      x: normalizedToCanvasPixels(
        numberAttribute(element, 'x', fallback.x / TELEMETRY_CANVAS_WIDTH),
        TELEMETRY_CANVAS_WIDTH
      ),
      y: normalizedToCanvasPixels(
        numberAttribute(element, 'y', fallback.y / TELEMETRY_CANVAS_HEIGHT),
        TELEMETRY_CANVAS_HEIGHT
      ),
      width: normalizedToCanvasPixels(
        numberAttribute(
          element,
          'width',
          fallback.width / TELEMETRY_CANVAS_WIDTH
        ),
        TELEMETRY_CANVAS_WIDTH
      ),
      height: normalizedToCanvasPixels(
        numberAttribute(
          element,
          'height',
          fallback.height / TELEMETRY_CANVAS_HEIGHT
        ),
        TELEMETRY_CANVAS_HEIGHT
      ),
      visible: element.getAttribute('visible') !== 'false',
    };
    const groupId = element.getAttribute('group');
    const grouping: Record<string, unknown> = {};
    if (groupId) {
      grouping.groupId = groupId;
      const group = groupNames.get(groupId);
      if (group?.name) grouping.groupName = group.name;
      if (group?.backgroundColor)
        grouping.groupBackgroundColor = group.backgroundColor;
      if (group?.backgroundOpacity !== undefined)
        grouping.groupBackgroundOpacity = group.backgroundOpacity;
      if (group?.borderRadius !== undefined)
        grouping.groupBorderRadius = group.borderRadius;
      if (group?.parentId) {
        grouping.parentGroupId = group.parentId;
        const parent = groupNames.get(group.parentId);
        if (parent?.name) grouping.parentGroupName = parent.name;
        if (parent?.backgroundColor)
          grouping.parentGroupBackgroundColor = parent.backgroundColor;
        if (parent?.backgroundOpacity !== undefined)
          grouping.parentGroupBackgroundOpacity = parent.backgroundOpacity;
        if (parent?.borderRadius !== undefined)
          grouping.parentGroupBorderRadius = parent.borderRadius;
      }
    }
    const name = element.getAttribute('label');
    const naming = name ? { name } : {};
    const backgroundAttribute = element.getAttribute('background');
    const borderAttribute = element.getAttribute('border');
    const styling: Record<string, unknown> = {};
    if (backgroundAttribute === 'transparent') {
      styling.transparent = true;
    } else if (backgroundAttribute === 'solid') {
      styling.transparent = false;
    }
    const rawItemBackgroundColor = element.getAttribute('background-color');
    if (
      rawItemBackgroundColor &&
      /^#[\da-f]{6}$/iu.test(rawItemBackgroundColor)
    ) {
      styling.backgroundColor = rawItemBackgroundColor;
    }
    if (element.hasAttribute('background-opacity')) {
      styling.backgroundOpacity = Math.max(
        0,
        Math.min(1, numberAttribute(element, 'background-opacity', 0.85))
      );
    }
    if (borderAttribute === 'true') {
      styling.border = true;
    } else if (borderAttribute === 'false') {
      styling.border = false;
    }
    if (element.getAttribute('label-visible') === 'false') {
      styling.showLabel = false;
    }
    if (type === 'widget' && element.getAttribute('unit-visible') === 'false') {
      styling.showUnit = false;
    }
    const rawFontSize = element.getAttribute('font-size');
    if (rawFontSize !== null && Number.isFinite(Number(rawFontSize))) {
      styling.fontSize = Number(rawFontSize);
    }
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
    const textAlign =
      type === 'text' &&
      VALUE_ALIGNMENTS.includes(
        element.getAttribute('align') as TelemetryValueAlignment
      )
        ? {
            textAlign: element.getAttribute('align') as TelemetryValueAlignment,
          }
        : {};
    if (type === 'icon') {
      return Object.assign(
        {},
        common,
        grouping,
        naming,
        styling,
        interactions,
        variant,
        valueAlign,
        {
          type: 'icon' as const,
          icon: ICONS.includes(
            element.getAttribute('name') as TelemetryIconName
          )
            ? (element.getAttribute('name') as TelemetryIconName)
            : 'gauge',
        }
      ) as FlightTelemetryLayoutItem;
    }
    if (type === 'text') {
      return Object.assign(
        {},
        common,
        grouping,
        naming,
        styling,
        interactions,
        variant,
        textAlign,
        {
          type: 'text' as const,
          content: element.getAttribute('content') ?? '',
        }
      ) as FlightTelemetryLayoutItem;
    }
    if (type === 'pip') {
      const rawSource = element.getAttribute('source');
      let source = DEFAULT_TELEMETRY_PIP_VIDEO_SOURCE;
      if (rawSource === 'camera') {
        source = 'file:face';
      } else if (rawSource === 'flight') {
        source = 'file:vol';
      } else if (
        TELEMETRY_PIP_VIDEO_SOURCES.includes(
          rawSource as TelemetryPipVideoSource
        )
      ) {
        source = rawSource as TelemetryPipVideoSource;
      }
      return Object.assign({}, common, grouping, naming, styling, {
        type: 'pip' as const,
        action: PIP_ACTIONS.includes(
          element.getAttribute('action') as TelemetryPipAction
        )
          ? (element.getAttribute('action') as TelemetryPipAction)
          : 'switch_video',
        source,
        applyOffset: element.getAttribute('apply-offset') !== 'false',
      }) as FlightTelemetryLayoutItem;
    }
    return Object.assign(
      {},
      common,
      grouping,
      naming,
      styling,
      interactions,
      variant,
      valueAlign,
      {
        type: 'widget' as const,
        metric: METRIC_KEYS.includes(metric) ? metric : fallback.metric,
      }
    ) as FlightTelemetryLayoutItem;
  });
  return withLayoutMetadata(
    parsed,
    document.documentElement.getAttribute('background-image') ?? undefined,
    document.documentElement.getAttribute('main-video-source') ?? undefined
  );
}

export function serializeTelemetryLayoutXml(
  layout: readonly FlightTelemetryLayoutItem[],
  options?: {
    backgroundImage?: string;
    mainVideoSource?: TelemetryMainVideoSource;
  }
) {
  const groupIds = Array.from(
    new Set(
      layout
        .flatMap((item) => [item.groupId, item.parentGroupId])
        .filter((groupId): groupId is string => Boolean(groupId))
    )
  );
  const groups = groupIds
    .map((groupId) => {
      const groupItems = layout.filter((item) => item.groupId === groupId);
      const nestedItems = layout.filter(
        (item) => item.parentGroupId === groupId
      );
      const groupName =
        groupItems.find((item) => item.groupName)?.groupName ??
        nestedItems.find((item) => item.parentGroupName)?.parentGroupName;
      const color =
        groupItems.find((item) => item.groupBackgroundColor)
          ?.groupBackgroundColor ??
        nestedItems.find((item) => item.parentGroupBackgroundColor)
          ?.parentGroupBackgroundColor;
      const opacity =
        groupItems.find((item) => item.groupBackgroundOpacity !== undefined)
          ?.groupBackgroundOpacity ??
        nestedItems.find(
          (item) => item.parentGroupBackgroundOpacity !== undefined
        )?.parentGroupBackgroundOpacity;
      const borderRadius =
        groupItems.find((item) => item.groupBorderRadius !== undefined)
          ?.groupBorderRadius ??
        nestedItems.find((item) => item.parentGroupBorderRadius !== undefined)
          ?.parentGroupBorderRadius;
      const actualParent = groupItems.length
        ? groupItems[0].parentGroupId
        : undefined;
      return `<group id="${escapeXml(groupId)}"${actualParent ? ` parent="${escapeXml(actualParent)}"` : ''}${groupName ? ` name="${escapeXml(groupName)}"` : ''}${color ? ` background-color="${escapeXml(color)}"` : ''}${opacity !== undefined ? ` background-opacity="${opacity}"` : ''}${borderRadius !== undefined ? ` border-radius="${borderRadius}"` : ''} />`;
    })
    .join('');
  const backgroundImage = options
    ? options.backgroundImage
    : (layout as TelemetryLayout).backgroundImage;
  const background = backgroundImage
    ? ` background-image="${escapeXml(backgroundImage)}"`
    : '';
  const mainVideoSource = options
    ? options.mainVideoSource
    : (layout as TelemetryLayout).mainVideoSource;
  const mainSource =
    mainVideoSource && mainVideoSource !== 'auto'
      ? ` main-video-source="${escapeXml(mainVideoSource)}"`
      : '';
  const root = `<telemetry-layout version="1" width="1920" height="1080"${background}${mainSource}>${groups}${layout
    .map((item) => {
      const name = item.name ? ` label="${escapeXml(item.name)}"` : '';
      const group = item.groupId ? ` group="${escapeXml(item.groupId)}"` : '';
      let background = '';
      if (item.transparent === true) {
        background = ' background="transparent"';
      } else if (item.transparent === false) {
        background = ' background="solid"';
      }
      const backgroundColor = item.backgroundColor
        ? ` background-color="${escapeXml(item.backgroundColor)}"`
        : '';
      const backgroundOpacity =
        item.backgroundOpacity !== undefined
          ? ` background-opacity="${item.backgroundOpacity}"`
          : '';
      let border = '';
      if (item.border === true) {
        border = ' border="true"';
      } else if (item.border === false) {
        border = ' border="false"';
      }
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
      const textAlign =
        item.type === 'text' && item.textAlign
          ? ` align="${item.textAlign}"`
          : '';
      const pipAction =
        item.type === 'pip'
          ? ` action="${item.action}" apply-offset="${item.applyOffset !== false}"`
          : '';
      const pipSource =
        item.type === 'pip' && item.source ? ` source="${item.source}"` : '';
      const common = `id="${escapeXml(item.id)}"${name}${group}${background}${backgroundColor}${backgroundOpacity}${border}${labelVisibility}${unitVisibility}${fontSize}${clickAction}${longPressAction}${variant}${valueAlign}${textAlign} x="${(item.x / TELEMETRY_CANVAS_WIDTH).toFixed(12)}" y="${(item.y / TELEMETRY_CANVAS_HEIGHT).toFixed(12)}" width="${(item.width / TELEMETRY_CANVAS_WIDTH).toFixed(12)}" height="${(item.height / TELEMETRY_CANVAS_HEIGHT).toFixed(12)}" visible="${item.visible ? 'true' : 'false'}"`;
      if (item.type === 'icon') return `<icon ${common} name="${item.icon}" />`;
      if (item.type === 'text') {
        return `<text ${common} content="${escapeXml(item.content)}" />`;
      }
      if (item.type === 'pip')
        return `<pip ${common}${pipAction}${pipSource} />`;
      return `<widget ${common} metric="${item.metric}" />`;
    })
    .join('')}</telemetry-layout>`;
  return new XMLSerializer().serializeToString(
    new DOMParser().parseFromString(root, 'application/xml')
  );
}

function withLayoutMetadata(
  items: FlightTelemetryLayoutItem[],
  backgroundImage?: string,
  rawMainVideoSource?: string
): TelemetryLayout {
  Object.defineProperty(items, 'backgroundImage', {
    value: backgroundImage,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(items, 'mainVideoSource', {
    value: TELEMETRY_PIP_VIDEO_SOURCES.includes(
      rawMainVideoSource as TelemetryPipVideoSource
    )
      ? rawMainVideoSource
      : 'auto',
    enumerable: false,
    configurable: true,
    writable: true,
  });
  return items as TelemetryLayout;
}

function escapeXml(value: string) {
  return value.replace(
    /[<>&'"]/gu,
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
