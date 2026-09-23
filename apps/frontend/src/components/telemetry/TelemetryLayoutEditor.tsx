import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@dashboard-parapente/design-system';
import {
  Download,
  ChevronDown,
  ClipboardPaste,
  Copy,
  AlignCenter,
  AlignCenterVertical,
  AlignEndVertical,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  Gauge,
  Grip,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Plus,
  Play,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Trash2,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  Button as AriaButton,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from 'react-aria-components';
import {
  useFlightTelemetry,
  type FlightTelemetryData,
} from '../../hooks/flights/useFlightTelemetry';
import { useToast } from '../../hooks/useToast';
import { getApiErrorMessage } from '../../lib/api';
import {
  defaultTelemetryLayout,
  useResetTelemetryLayout,
  useSaveTelemetryLayout,
  useTelemetryLayout,
} from '../../hooks/flights/useTelemetryLayout';
import { parseTelemetryGpxFile } from '../flights/details/telemetryGpxPreview';
import {
  parseTelemetryLayoutXml,
  serializeTelemetryLayoutXml,
  getTelemetryLayoutGroupBounds,
  type FlightTelemetryIconLayout,
  type FlightTelemetryLayoutItem,
  type FlightTelemetryPipLayout,
  type FlightTelemetryTextLayout,
  type TelemetryWidgetVariant,
} from '../flights/details/flightTelemetryLayout';
import { TelemetryLayoutIcon } from './TelemetryLayoutIcon';
import { TelemetrySpeedometer } from './TelemetrySpeedometer';
import {
  METRIC_KEYS as METRICS,
  METRIC_LABELS,
  formatTelemetryValue,
  getTelemetryMetricValue,
  type MetricKey as Metric,
} from '../flights/details/telemetryMetrics';

type DragMode = 'move' | 'resize';

const MAX_LAYOUT_XML_LENGTH = 500_000;
const MAX_BACKGROUND_IMAGE_LENGTH = 480_000;
const SNAP_THRESHOLD = 0.012;
const KEYBOARD_PIXEL_STEP_X = 1 / 1920;
const KEYBOARD_PIXEL_STEP_Y = 1 / 1080;

function displayWidgetName(name: string) {
  return name.replace(/_/gu, ' ');
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

async function compressBackgroundImage(file: File) {
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Unable to read background image'));
    reader.onerror = () =>
      reject(reader.error ?? new Error('Unable to read background image'));
    reader.readAsDataURL(file);
  });
  if (original.length <= MAX_BACKGROUND_IMAGE_LENGTH) return original;

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const loadedImage = new Image();
      loadedImage.onload = () => resolve(loadedImage);
      loadedImage.onerror = () => reject(new Error('Invalid background image'));
      loadedImage.src = objectUrl;
    });
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight)
      throw new Error('Invalid background image');

    const qualityLevels = [0.82, 0.68, 0.54, 0.4];
    const scaleLevels = [1, 0.8, 0.6, 0.4];
    for (const scaleLevel of scaleLevels) {
      const scale = Math.min(
        scaleLevel,
        1920 / sourceWidth,
        1080 / sourceHeight
      );
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is unavailable');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      for (const quality of qualityLevels) {
        const webp = canvas.toDataURL('image/webp', quality);
        const compressed = webp.startsWith('data:image/webp')
          ? webp
          : canvas.toDataURL('image/jpeg', quality);
        if (compressed.length <= MAX_BACKGROUND_IMAGE_LENGTH) {
          return compressed;
        }
      }
    }
    throw new Error('Background image is too large after compression');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function TelemetryLayoutEditor({ flightId }: { flightId?: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const layoutQuery = useTelemetryLayout(flightId);
  const telemetryQuery = useFlightTelemetry(flightId ?? '', Boolean(flightId));
  const saveLayout = useSaveTelemetryLayout(flightId);
  const resetLayout = useResetTelemetryLayout(flightId ?? '');
  const canvasRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const widgetIdCounter = useRef(0);
  const [layout, setLayoutState] = useState<FlightTelemetryLayoutItem[]>(
    defaultTelemetryLayout
  );
  const layoutHistory = useRef<FlightTelemetryLayoutItem[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string>();
  const [localTelemetry, setLocalTelemetry] = useState<FlightTelemetryData>();
  const [gpxFileName, setGpxFileName] = useState<string>();
  const [gpxError, setGpxError] = useState(false);
  const [gpxPointIndex, setGpxPointIndex] = useState(0);
  const [isGpxPlaying, setIsGpxPlaying] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    layout[0]?.id ? [layout[0].id] : []
  );
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
    () => new Set()
  );
  const [copiedItems, setCopiedItems] = useState<FlightTelemetryLayoutItem[]>(
    []
  );
  const [snapGuides, setSnapGuides] = useState<{
    x?: number;
    y?: number;
  }>({});
  const [drag, setDrag] = useState<{
    mode: DragMode;
    startX: number;
    startY: number;
    items: FlightTelemetryLayoutItem[];
  } | null>(null);

  const setLayout = useCallback(
    (
      nextLayout:
        | FlightTelemetryLayoutItem[]
        | ((
            current: FlightTelemetryLayoutItem[]
          ) => FlightTelemetryLayoutItem[])
    ) => {
      const next =
        typeof nextLayout === 'function' ? nextLayout(layout) : nextLayout;
      if (next === layout) return;
      layoutHistory.current.push(layout);
      setCanUndo(true);
      setLayoutState(next);
    },
    [layout]
  );

  const undoLayout = useCallback(() => {
    const previous = layoutHistory.current.pop();
    if (!previous) return;
    setLayoutState(previous);
    setCanUndo(layoutHistory.current.length > 0);
    setSelectedIds((current) => {
      const validIds = new Set(previous.map((item) => item.id));
      const retained = current.filter((id) => validIds.has(id));
      return retained.length
        ? retained
        : previous[0]?.id
          ? [previous[0].id]
          : [];
    });
  }, []);

  useEffect(() => {
    if (layoutQuery.data?.layout) {
      layoutHistory.current = [];
      setCanUndo(false);
      setLayoutState(layoutQuery.data.layout);
      setSelectedIds(
        layoutQuery.data.layout[0]?.id ? [layoutQuery.data.layout[0].id] : []
      );
    }
  }, [layoutQuery.data?.layout]);

  const selected = layout.find((item) => item.id === selectedIds[0]) ?? null;
  const selectedGroupId = (() => {
    const groupIds = new Set(
      layout
        .filter((item) => selectedIds.includes(item.id) && item.groupId)
        .map((item) => item.groupId)
    );
    if (groupIds.size !== 1) return undefined;
    const groupId = [...groupIds][0];
    const children = layout.filter((item) => item.groupId === groupId);
    return children.length === selectedIds.length &&
      children.every((item) => selectedIds.includes(item.id))
      ? groupId
      : undefined;
  })();
  const selectedGroupName = selectedGroupId
    ? (layout.find((item) => item.groupId === selectedGroupId)?.groupName ??
      selectedGroupId)
    : undefined;
  const groups = Array.from(
    new Map(
      layout
        .filter((item) => item.groupId)
        .map((item) => [item.groupId as string, item.groupName ?? item.groupId])
    )
  );
  const ungroupedItems = layout.filter((item) => !item.groupId);
  const previewTelemetry = localTelemetry ?? telemetryQuery.data;
  const previewPoint =
    previewTelemetry?.points[localTelemetry ? gpxPointIndex : 0];

  useEffect(() => {
    if (!isGpxPlaying || !localTelemetry) return;
    const timer = window.setInterval(() => {
      setGpxPointIndex((current) => {
        const lastIndex = localTelemetry.points.length - 1;
        if (current >= lastIndex) {
          setIsGpxPlaying(false);
          return lastIndex;
        }
        return current + 1;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [isGpxPlaying, localTelemetry]);

  const handleGpxFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setLocalTelemetry(await parseTelemetryGpxFile(file));
      setGpxFileName(file.name);
      setGpxError(false);
      setGpxPointIndex(0);
      setIsGpxPlaying(false);
    } catch {
      setLocalTelemetry(undefined);
      setGpxFileName(undefined);
      setGpxError(true);
      setGpxPointIndex(0);
      setIsGpxPlaying(false);
    }
  };

  const handleBackgroundImage = async (file: File | undefined) => {
    if (!file) return;
    try {
      const compressedImage = await compressBackgroundImage(file);
      setSaveError(undefined);
      setBackgroundImage(compressedImage);
    } catch {
      const message = t('telemetryLayout.backgroundImageTooLarge');
      setSaveError(message);
      toast.error(message);
    }
  };

  const handleLayoutXmlFile = async (file: File | undefined) => {
    if (!file) return;

    try {
      if (file.size > MAX_LAYOUT_XML_LENGTH) {
        throw new Error('Layout XML is too large');
      }
      const xml = await file.text();
      if (xml.length > MAX_LAYOUT_XML_LENGTH) {
        throw new Error('Layout XML is too large');
      }

      const document = new DOMParser().parseFromString(xml, 'application/xml');
      if (
        document.querySelector('parsererror') ||
        document.documentElement.tagName !== 'telemetry-layout'
      ) {
        throw new Error('Invalid telemetry layout XML');
      }

      const importedLayout = parseTelemetryLayoutXml(xml);
      if (!importedLayout.length) {
        throw new Error('Telemetry layout XML is empty');
      }

      layoutHistory.current = [];
      setCanUndo(false);
      setLayoutState(importedLayout);
      setBackgroundImage(importedLayout.backgroundImage);
      setSelectedIds(importedLayout[0]?.id ? [importedLayout[0].id] : []);
      setSaveError(undefined);
      toast.success(t('telemetryLayout.importSuccess'));
    } catch {
      const message = t('telemetryLayout.importError');
      setSaveError(message);
      toast.error(message);
    }
  };

  const handleSave = async () => {
    if (!layoutQuery.data) {
      const message = t('telemetryLayout.loading');
      setSaveError(message);
      toast.error(message);
      return;
    }
    const invalidName = layout.find(
      (item) => item.name !== undefined && item.name.length > 100
    );
    const invalidGroupName = layout.find(
      (item) => item.groupName !== undefined && item.groupName.length > 100
    );
    const emptyText = layout.find(
      (item) => item.type === 'text' && item.content.trim().length === 0
    );
    const xmlLength = serializeTelemetryLayoutXml(layout).length;
    const validationMessage = invalidName
      ? t('telemetryLayout.nameTooLong')
      : invalidGroupName
        ? t('telemetryLayout.groupNameTooLong')
        : emptyText
          ? t('telemetryLayout.textRequired')
          : xmlLength > MAX_LAYOUT_XML_LENGTH
            ? t('telemetryLayout.layoutTooLarge')
            : undefined;

    if (validationMessage) {
      setSaveError(validationMessage);
      toast.error(validationMessage);
      return;
    }

    try {
      setSaveError(undefined);
      await saveLayout.mutateAsync({ layout, backgroundImage });
      setBackgroundImage(backgroundImage);
      toast.success(t('telemetryLayout.saveSuccess'));
    } catch (error) {
      const message = await getApiErrorMessage(
        error,
        t('telemetryLayout.saveError')
      );
      setSaveError(message);
      toast.error(message);
    }
  };

  const hierarchyLabel = (item: FlightTelemetryLayoutItem) =>
    displayWidgetName(
      item.name ??
        (item.type === 'widget'
          ? item.metric
          : item.type === 'icon'
            ? item.icon
            : item.type === 'text'
              ? item.content
              : 'PiP vidéo')
    );

  const selectFromHierarchy = (ids: string[], additive: boolean) => {
    setSelectedIds((current) => {
      if (!additive) return ids;
      const allSelected = ids.every((id) => current.includes(id));
      if (allSelected) return current.filter((id) => !ids.includes(id));
      return [...new Set([...current, ...ids])];
    });
  };

  useEffect(() => {
    const handleFullscreenChange = () =>
      setIsFullscreen(document.fullscreenElement === editorRef.current);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await editorRef.current?.requestFullscreen();
    }
  };

  const addField = () => {
    const id = `field-${Date.now()}-${widgetIdCounter.current++}`;
    const metric =
      METRICS.find((candidate) =>
        layout.every(
          (widget) => widget.type !== 'widget' || widget.metric !== candidate
        )
      ) ?? METRICS[0];
    const column = layout.length % 4;
    const row = Math.floor(layout.length / 4);
    const widget: FlightTelemetryLayoutItem = {
      id,
      type: 'widget',
      name: metric,
      metric,
      x: 0.02 + column * 0.24,
      y: 0.02 + row * 0.2,
      width: 0.16,
      height: 0.1,
      visible: true,
    };
    setLayout((current) => [...current, widget]);
    setSelectedIds([id]);
  };

  const addIcon = () => {
    const id = `icon-${Date.now()}-${widgetIdCounter.current++}`;
    const column = layout.length % 4;
    const row = Math.floor(layout.length / 4);
    const icon: FlightTelemetryIconLayout = {
      id,
      name: 'Gauge',
      type: 'icon',
      icon: 'gauge',
      x: 0.02 + column * 0.24,
      y: 0.02 + row * 0.2,
      width: 0.1,
      height: 0.1,
      visible: true,
    };
    setLayout((current) => [...current, icon]);
    setSelectedIds([id]);
  };

  const addGraphicalWidget = (
    variant: Exclude<TelemetryWidgetVariant, 'value'>
  ) => {
    const id = `${variant}-${Date.now()}-${widgetIdCounter.current++}`;
    const column = layout.length % 4;
    const row = Math.floor(layout.length / 4);
    const widget: FlightTelemetryLayoutItem = {
      id,
      type: 'widget',
      name: variant,
      metric: variant === 'compass' ? 'heading' : 'speed',
      variant,
      x: 0.02 + column * 0.24,
      y: 0.02 + row * 0.2,
      width: 0.18,
      height: 0.18,
      visible: true,
    };
    setLayout((current) => [...current, widget]);
    setSelectedIds([id]);
  };

  const addSpeedometer = () => addGraphicalWidget('speedometer');

  const addText = () => {
    const id = `text-${Date.now()}-${widgetIdCounter.current++}`;
    const column = layout.length % 4;
    const row = Math.floor(layout.length / 4);
    const text: FlightTelemetryTextLayout = {
      id,
      type: 'text',
      name: 'Text',
      content: 'Votre texte',
      x: 0.02 + column * 0.24,
      y: 0.02 + row * 0.2,
      width: 0.2,
      height: 0.08,
      visible: true,
    };
    setLayout((current) => [...current, text]);
    setSelectedIds([id]);
  };

  const addPip = () => {
    const id = `pip-${Date.now()}-${widgetIdCounter.current++}`;
    const pip: FlightTelemetryPipLayout = {
      id,
      type: 'pip',
      name: 'PiP vidéo',
      action: 'switch_video',
      x: 0.02,
      y: 0.78,
      width: 0.18,
      height: 0.18,
      visible: true,
    };
    setLayout((current) => [...current, pip]);
    setSelectedIds([id]);
  };

  const removeSelectedField = () => {
    if (!selectedIds.length || layout.length <= selectedIds.length) return;
    const nextLayout = layout.filter((item) => !selectedIds.includes(item.id));
    setLayout(nextLayout);
    setSelectedIds(nextLayout[0]?.id ? [nextLayout[0].id] : []);
  };

  const updateItem = (
    id: string,
    updates: Partial<FlightTelemetryLayoutItem>
  ) => {
    setLayout((current) =>
      current.map((widget) =>
        widget.id === id
          ? ({ ...widget, ...updates } as FlightTelemetryLayoutItem)
          : widget
      )
    );
  };

  const groupSelected = () => {
    if (selectedIds.length < 2) return;
    const existingGroupIds = new Set(
      layout
        .filter((item) => selectedIds.includes(item.id) && item.groupId)
        .map((item) => item.groupId)
    );
    const existingGroupId =
      existingGroupIds.size === 1 ? [...existingGroupIds][0] : undefined;
    const existingGroupName = existingGroupId
      ? layout.find((item) => item.groupId === existingGroupId)?.groupName
      : undefined;
    const groupId =
      existingGroupId ?? `group-${Date.now()}-${widgetIdCounter.current++}`;
    const groupName = existingGroupName ?? `Group ${widgetIdCounter.current}`;
    setLayout((current) =>
      current.map((item) =>
        selectedIds.includes(item.id) ? { ...item, groupId, groupName } : item
      )
    );
  };

  const ungroupSelected = () => {
    const groupIds = new Set(
      layout
        .filter((item) => selectedIds.includes(item.id) && item.groupId)
        .map((item) => item.groupId)
    );
    if (!groupIds.size) return;
    setLayout((current) =>
      current.map((item) =>
        item.groupId && groupIds.has(item.groupId)
          ? { ...item, groupId: undefined, groupName: undefined }
          : item
      )
    );
  };

  const isWholeGroupSelected = useCallback(
    (item: FlightTelemetryLayoutItem) => {
      if (!item.groupId) return false;
      const groupItems = layout.filter(
        (candidate) => candidate.groupId === item.groupId
      );
      return (
        groupItems.length === selectedIds.length &&
        groupItems.every((candidate) => selectedIds.includes(candidate.id))
      );
    },
    [layout, selectedIds]
  );

  const beginDrag = (
    event: PointerEvent,
    item: FlightTelemetryLayoutItem,
    mode: DragMode
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      setSelectedIds((current) =>
        current.includes(item.id)
          ? current.filter((id) => id !== item.id)
          : [...current, item.id]
      );
      return;
    }
    const groupItems = isWholeGroupSelected(item)
      ? layout.filter((candidate) => candidate.groupId === item.groupId)
      : selectedIds.includes(item.id)
        ? layout.filter((candidate) => selectedIds.includes(candidate.id))
        : [item];
    const movingItems = mode === 'resize' ? [item] : groupItems;
    setSnapGuides({});
    setSelectedIds(movingItems.map((candidate) => candidate.id));
    setDrag({
      mode,
      startX: event.clientX,
      startY: event.clientY,
      items: movingItems,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: PointerEvent) => {
    if (!drag || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = (event.clientX - drag.startX) / rect.width;
    const dy = (event.clientY - drag.startY) / rect.height;
    if (drag.mode === 'move') {
      const movingIds = new Set(drag.items.map((item) => item.id));
      const stationaryItems = layout.filter((item) => !movingIds.has(item.id));
      const movingBounds = {
        left: Math.min(...drag.items.map((item) => item.x + dx)),
        top: Math.min(...drag.items.map((item) => item.y + dy)),
        right: Math.max(...drag.items.map((item) => item.x + dx + item.width)),
        bottom: Math.max(
          ...drag.items.map((item) => item.y + dy + item.height)
        ),
      };
      const findSnap = (
        anchors: number[],
        targets: number[]
      ): { offset: number; target: number } | undefined => {
        let closest:
          | { offset: number; target: number; distance: number }
          | undefined;
        for (const anchor of anchors) {
          for (const target of targets) {
            const offset = target - anchor;
            const distance = Math.abs(offset);
            if (
              distance <= SNAP_THRESHOLD &&
              (!closest || distance < closest.distance)
            ) {
              closest = { offset, target, distance };
            }
          }
        }
        return closest;
      };
      const xSnap = findSnap(
        [
          movingBounds.left,
          (movingBounds.left + movingBounds.right) / 2,
          movingBounds.right,
        ],
        [
          0,
          0.5,
          1,
          ...stationaryItems.flatMap((item) => [
            item.x,
            item.x + item.width / 2,
            item.x + item.width,
          ]),
        ]
      );
      const ySnap = findSnap(
        [
          movingBounds.top,
          (movingBounds.top + movingBounds.bottom) / 2,
          movingBounds.bottom,
        ],
        [
          0,
          0.5,
          1,
          ...stationaryItems.flatMap((item) => [
            item.y,
            item.y + item.height / 2,
            item.y + item.height,
          ]),
        ]
      );
      const snappedDx = dx + (xSnap?.offset ?? 0);
      const snappedDy = dy + (ySnap?.offset ?? 0);
      setSnapGuides({ x: xSnap?.target, y: ySnap?.target });
      setLayout((current) =>
        current.map((item) => {
          const original = drag.items.find(
            (candidate) => candidate.id === item.id
          );
          if (!original) return item;
          return {
            ...item,
            x: clamp(original.x + snappedDx, 0, 1 - original.width),
            y: clamp(original.y + snappedDy, 0, 1 - original.height),
          };
        })
      );
    } else {
      const original = drag.items[0];
      updateItem(original.id, {
        width: clamp(original.width + dx, 0.05, 1 - original.x),
        height: clamp(original.height + dy, 0.05, 1 - original.y),
      });
    }
  };

  const moveWithKeyboard = useCallback(
    (item: FlightTelemetryLayoutItem, dx: number, dy: number) => {
      const movingIds = isWholeGroupSelected(item)
        ? new Set(
            layout
              .filter((candidate) => candidate.groupId === item.groupId)
              .map((candidate) => candidate.id)
          )
        : new Set(selectedIds.includes(item.id) ? selectedIds : [item.id]);

      setSelectedIds([...movingIds]);
      setLayout((current) =>
        current.map((candidate) => {
          if (!movingIds.has(candidate.id)) return candidate;
          return {
            ...candidate,
            x: clamp(candidate.x + dx, 0, 1 - candidate.width),
            y: clamp(candidate.y + dy, 0, 1 - candidate.height),
          };
        })
      );
    },
    [isWholeGroupSelected, layout, selectedIds, setLayout]
  );

  const copySelected = useCallback(() => {
    const items = selectedGroupId
      ? layout.filter((item) => item.groupId === selectedGroupId)
      : layout.filter((item) => selectedIds.includes(item.id));
    if (!items.length) {
      toast.error(t('telemetryLayout.nothingToCopy'));
      return;
    }
    setCopiedItems(items);
    toast.success(t('telemetryLayout.copySuccess'));
  }, [layout, selectedGroupId, selectedIds, t, toast]);

  const pasteCopied = useCallback(() => {
    if (!copiedItems.length) {
      toast.error(t('telemetryLayout.nothingToPaste'));
      return;
    }
    const copiedIds = new Set(copiedItems.map((item) => item.id));
    const completeGroupIds = new Set(
      copiedItems
        .filter((item) => item.groupId)
        .map((item) => item.groupId)
        .filter((groupId, index, groupIds) => {
          if (!groupId || groupIds.indexOf(groupId) !== index) return false;
          return layout
            .filter((item) => item.groupId === groupId)
            .every((item) => copiedIds.has(item.id));
        })
    );
    const groupIdMap = new Map<string, string>();
    const pastedItems = copiedItems.map((item) => {
      const id = `${item.type}-${Date.now()}-${widgetIdCounter.current++}`;
      const groupId =
        item.groupId && completeGroupIds.has(item.groupId)
          ? (groupIdMap.get(item.groupId) ??
            `group-${Date.now()}-${widgetIdCounter.current++}`)
          : undefined;
      if (item.groupId && groupId && !groupIdMap.has(item.groupId)) {
        groupIdMap.set(item.groupId, groupId);
      }
      return {
        ...item,
        id,
        x: clamp(item.x + 0.02, 0, 1 - item.width),
        y: clamp(item.y + 0.02, 0, 1 - item.height),
        ...(groupId
          ? { groupId, groupName: item.groupName }
          : { groupId: undefined, groupName: undefined }),
      };
    });
    setLayout((current) => [...current, ...pastedItems]);
    setSelectedIds(pastedItems.map((item) => item.id));
    toast.success(t('telemetryLayout.pasteSuccess'));
  }, [copiedItems, layout, setLayout, t, toast]);

  const alignSelected = (
    direction:
      | 'left'
      | 'center'
      | 'right'
      | 'top'
      | 'middle'
      | 'bottom'
      | 'row'
      | 'column'
  ) => {
    const selectedItems = layout.filter((item) =>
      selectedIds.includes(item.id)
    );
    if (selectedItems.length < 2) return;
    const left = Math.min(...selectedItems.map((item) => item.x));
    const top = Math.min(...selectedItems.map((item) => item.y));
    const right = Math.max(...selectedItems.map((item) => item.x + item.width));
    const bottom = Math.max(
      ...selectedItems.map((item) => item.y + item.height)
    );
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    const referenceX = selectedItems[0].x;
    const referenceY = selectedItems[0].y;

    setLayout((current) =>
      current.map((item) => {
        if (!selectedIds.includes(item.id)) return item;
        if (direction === 'row') return { ...item, y: referenceY };
        if (direction === 'column') return { ...item, x: referenceX };
        if (direction === 'left') return { ...item, x: left };
        if (direction === 'center') {
          return {
            ...item,
            x: clamp(centerX - item.width / 2, 0, 1 - item.width),
          };
        }
        if (direction === 'right') {
          return { ...item, x: clamp(right - item.width, 0, 1 - item.width) };
        }
        if (direction === 'top') return { ...item, y: top };
        if (direction === 'middle') {
          return {
            ...item,
            y: clamp(centerY - item.height / 2, 0, 1 - item.height),
          };
        }
        return { ...item, y: clamp(bottom - item.height, 0, 1 - item.height) };
      })
    );
  };

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable
      ) {
      }
      const movement = {
        ArrowLeft: [-KEYBOARD_PIXEL_STEP_X, 0],
        ArrowRight: [KEYBOARD_PIXEL_STEP_X, 0],
        ArrowUp: [0, -KEYBOARD_PIXEL_STEP_Y],
        ArrowDown: [0, KEYBOARD_PIXEL_STEP_Y],
      }[event.key];
      if (
        movement &&
        target &&
        editorRef.current?.contains(target) &&
        !canvasRef.current?.contains(target)
      ) {
        const selectedItem = layout.find((item) =>
          selectedIds.includes(item.id)
        );
        if (selectedItem) {
          const multiplier = event.ctrlKey || event.metaKey ? 10 : 1;
          event.preventDefault();
          moveWithKeyboard(
            selectedItem,
            movement[0] * multiplier,
            movement[1] * multiplier
          );
        }
        return;
      }
    };
    const editor = editorRef.current;
    editor?.addEventListener('keydown', handleKeyboardShortcut);
    return () => editor?.removeEventListener('keydown', handleKeyboardShortcut);
  }, [
    copySelected,
    layout,
    moveWithKeyboard,
    pasteCopied,
    selectedIds,
    undoLayout,
  ]);

  useEffect(() => {
    const handleClipboardShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        !target ||
        !editorRef.current?.contains(target) ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable ||
        !(event.ctrlKey || event.metaKey)
      ) {
        return;
      }
      const shortcut = event.key.toLowerCase();
      if (shortcut === 'c') {
        event.preventDefault();
        event.stopPropagation();
        copySelected();
      } else if (shortcut === 'v') {
        event.preventDefault();
        event.stopPropagation();
        pasteCopied();
      } else if (shortcut === 'z') {
        event.preventDefault();
        event.stopPropagation();
        undoLayout();
      }
    };
    document.addEventListener('keydown', handleClipboardShortcut, true);
    return () =>
      document.removeEventListener('keydown', handleClipboardShortcut, true);
  }, [copySelected, pasteCopied, undoLayout]);

  const downloadXml = () => {
    const xmlDocument = [...layout] as typeof layout & {
      backgroundImage?: string;
    };
    xmlDocument.backgroundImage = backgroundImage;
    const blob = new Blob(
      [serializeTelemetryLayoutXml(xmlDocument, { backgroundImage })],
      { type: 'application/xml' }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = flightId
      ? `telemetry-layout-${flightId}.xml`
      : 'telemetry-layout-default.xml';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (layoutQuery.isPending) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-gray-800">
        {t('telemetryLayout.loading')}
      </div>
    );
  }

  return (
    <div
      ref={editorRef}
      className={`space-y-5 ${isFullscreen ? 'overflow-y-auto bg-slate-950 p-4 sm:p-6' : ''}`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-3 ${
          isFullscreen
            ? 'sticky top-0 z-50 rounded-xl bg-slate-950/95 py-2 backdrop-blur'
            : ''
        }`}
      >
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('telemetryLayout.canvasHint')}
          </p>
          {flightId && !layoutQuery.data?.is_override && (
            <p className="mt-1 text-xs font-medium text-violet-600 dark:text-violet-300">
              {t('telemetryLayout.usingDefault')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 font-medium dark:border-slate-600">
            <Upload className="h-4 w-4" />
            {t('telemetryLayout.loadGpx')}
            <input
              type="file"
              accept=".gpx,application/gpx+xml,application/xml"
              className="sr-only"
              onChange={(event) => void handleGpxFile(event.target.files?.[0])}
            />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 font-medium dark:border-slate-600">
            <Upload className="h-4 w-4" />
            {t('telemetryLayout.import')}
            <input
              type="file"
              accept=".xml,application/xml,text/xml"
              className="sr-only"
              onChange={(event) => {
                void handleLayoutXmlFile(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </label>
          {gpxFileName && (
            <span className="max-w-40 truncate text-emerald-600 dark:text-emerald-300">
              {gpxFileName}
            </span>
          )}
          {localTelemetry && (
            <div className="flex min-w-72 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2 py-1.5 dark:border-slate-600">
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  if (gpxPointIndex >= localTelemetry.points.length - 1) {
                    setGpxPointIndex(0);
                  }
                  setIsGpxPlaying((playing) => !playing);
                }}
                aria-label={
                  isGpxPlaying
                    ? t('telemetryLayout.pauseGpx')
                    : t('telemetryLayout.playGpx')
                }
              >
                {isGpxPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {isGpxPlaying
                  ? t('telemetryLayout.pauseGpx')
                  : t('telemetryLayout.playGpx')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => {
                  setGpxPointIndex(0);
                  setIsGpxPlaying(false);
                }}
                aria-label={t('telemetryLayout.restartGpx')}
                title={t('telemetryLayout.restartGpx')}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <input
                className="min-w-0 flex-1 accent-sky-500"
                type="range"
                min="0"
                max={Math.max(localTelemetry.points.length - 1, 0)}
                value={gpxPointIndex}
                onChange={(event) => {
                  setGpxPointIndex(Number(event.target.value));
                  setIsGpxPlaying(false);
                }}
                aria-label={t('telemetryLayout.gpxProgress')}
              />
              <span className="whitespace-nowrap text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {gpxPointIndex + 1}/{localTelemetry.points.length}
              </span>
            </div>
          )}
          {gpxError && (
            <span className="text-rose-600 dark:text-rose-300">
              {t('telemetryLayout.gpxError')}
            </span>
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 font-medium dark:border-slate-600">
            <ImageIcon className="h-4 w-4" />
            {t('telemetryLayout.backgroundImage')}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) =>
                void handleBackgroundImage(event.target.files?.[0])
              }
            />
          </label>
          {backgroundImage && (
            <Button
              variant="ghost"
              size="sm"
              onPress={() => setBackgroundImage(undefined)}
            >
              <Trash2 className="h-4 w-4" />
              {t('telemetryLayout.removeBackground')}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onPress={undoLayout}
            isDisabled={!canUndo}
            aria-label={t('telemetryLayout.undo')}
            aria-keyshortcuts="Control+Z Meta+Z"
            title={t('telemetryLayout.undo')}
          >
            <Undo2 className="h-4 w-4" />
            {t('telemetryLayout.undo')}
          </Button>
          <div className="flex items-center gap-1 rounded-lg border border-slate-300 px-1 dark:border-slate-600">
            <Button
              variant="ghost"
              size="sm"
              onPress={() =>
                setCanvasZoom((current) => clamp(current - 0.25, 0.5, 2))
              }
              isDisabled={canvasZoom <= 0.5}
              aria-label={t('telemetryLayout.zoomOut')}
              title={t('telemetryLayout.zoomOut')}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <button
              type="button"
              className="min-w-12 px-1 text-center text-xs font-medium text-slate-600 dark:text-slate-300"
              onClick={() => setCanvasZoom(1)}
              title={t('telemetryLayout.resetZoom')}
            >
              {Math.round(canvasZoom * 100)}%
            </button>
            <Button
              variant="ghost"
              size="sm"
              onPress={() =>
                setCanvasZoom((current) => clamp(current + 0.25, 0.5, 2))
              }
              isDisabled={canvasZoom >= 2}
              aria-label={t('telemetryLayout.zoomIn')}
              title={t('telemetryLayout.zoomIn')}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onPress={copySelected}
            isDisabled={!selectedIds.length}
            aria-label={t('telemetryLayout.copy')}
            aria-keyshortcuts="Control+C Meta+C"
          >
            <Copy className="h-4 w-4" />
            {t('telemetryLayout.copy')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onPress={pasteCopied}
            isDisabled={!copiedItems.length}
            aria-label={t('telemetryLayout.paste')}
            aria-keyshortcuts="Control+V Meta+V"
          >
            <ClipboardPaste className="h-4 w-4" />
            {t('telemetryLayout.paste')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onPress={() => void toggleFullscreen()}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
            {isFullscreen
              ? t('telemetryLayout.exitFullscreen')
              : t('telemetryLayout.fullscreen')}
          </Button>
          <MenuTrigger>
            <AriaButton className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800">
              <Plus className="h-4 w-4" />
              {t('telemetryLayout.addElement')}
            </AriaButton>
            <Popover
              UNSTABLE_portalContainer={editorRef.current ?? undefined}
              className="z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-800"
            >
              <Menu className="outline-none">
                <MenuItem
                  isDisabled
                  className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  {t('telemetryLayout.telemetryElements')}
                </MenuItem>
                <MenuItem
                  onAction={addField}
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-100 focus:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus:bg-slate-700"
                >
                  <Plus className="h-4 w-4" />
                  {t('telemetryLayout.addField')}
                </MenuItem>
                <MenuItem
                  onAction={addSpeedometer}
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-100 focus:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus:bg-slate-700"
                >
                  <Gauge className="h-4 w-4" />
                  {t('telemetryLayout.addSpeedometer')}
                </MenuItem>
                {(['compass', 'bar', 'chart', 'asi'] as const).map(
                  (variant) => (
                    <MenuItem
                      key={variant}
                      onAction={() => addGraphicalWidget(variant)}
                      className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-100 focus:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus:bg-slate-700"
                    >
                      <Gauge className="h-4 w-4" />
                      {t(`telemetryLayout.widgetModels.${variant}`)}
                    </MenuItem>
                  )
                )}
                <MenuItem
                  isDisabled
                  className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  {t('telemetryLayout.visualElements')}
                </MenuItem>
                <MenuItem
                  onAction={addIcon}
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-100 focus:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus:bg-slate-700"
                >
                  <Plus className="h-4 w-4" />
                  {t('telemetryLayout.addIcon')}
                </MenuItem>
                <MenuItem
                  onAction={addText}
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-100 focus:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus:bg-slate-700"
                >
                  <Plus className="h-4 w-4" />
                  {t('telemetryLayout.addText')}
                </MenuItem>
                <MenuItem
                  onAction={addPip}
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-100 focus:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus:bg-slate-700"
                >
                  <PictureInPicture2 className="h-4 w-4" />
                  {t('telemetryLayout.addPip')}
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
          <Button variant="outline" size="sm" onPress={downloadXml}>
            <Download className="h-4 w-4" />
            {t('telemetryLayout.export')}
          </Button>
          {flightId && layoutQuery.data?.is_override && (
            <Button
              variant="ghost"
              size="sm"
              onPress={() => void resetLayout.mutateAsync()}
            >
              <RotateCcw className="h-4 w-4" />
              {t('telemetryLayout.reset')}
            </Button>
          )}
          <Button
            size="sm"
            onPress={() => void handleSave()}
            isDisabled={saveLayout.isPending || layoutQuery.isLoading}
          >
            <Save className="h-4 w-4" />
            {saveLayout.isPending
              ? t('telemetryLayout.saving')
              : t('telemetryLayout.save')}
          </Button>
        </div>
      </div>
      {saveError && (
        <p
          role="alert"
          className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300"
        >
          {saveError}
        </p>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 rounded-2xl border border-slate-700 bg-slate-950 p-3 shadow-xl">
          <div className="max-w-full overflow-auto">
            <div
              ref={canvasRef}
              className={`relative mx-auto aspect-video overflow-hidden rounded-lg border border-slate-700 bg-[radial-gradient(circle_at_50%_35%,#1e3a5f,#090f1b_65%)] select-none ${canvasZoom === 1 && !isFullscreen ? 'max-w-5xl' : ''}`}
              style={{
                width: `${canvasZoom * 100}%`,
                containerType: 'inline-size',
                backgroundImage: backgroundImage
                  ? `url(${JSON.stringify(backgroundImage)})`
                  : undefined,
                backgroundSize: backgroundImage ? 'cover' : undefined,
                backgroundPosition: backgroundImage ? 'center' : undefined,
              }}
              onPointerMove={moveDrag}
              onPointerUp={() => {
                setDrag(null);
                setSnapGuides({});
              }}
              onPointerCancel={() => {
                setDrag(null);
                setSnapGuides({});
              }}
              aria-label={t('telemetryLayout.canvasLabel')}
            >
              <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(#94a3b8_1px,transparent_1px),linear-gradient(90deg,#94a3b8_1px,transparent_1px)] [background-size:10%_10%]" />
              <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-slate-400/20" />
              <div className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-slate-400/20" />
              {snapGuides.x !== undefined && (
                <div
                  className="pointer-events-none absolute inset-y-0 z-30 border-l-2 border-dashed border-amber-300"
                  style={{ left: `${snapGuides.x * 100}%` }}
                />
              )}
              {snapGuides.y !== undefined && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-30 border-t-2 border-dashed border-amber-300"
                  style={{ top: `${snapGuides.y * 100}%` }}
                />
              )}
              {groups.map(([groupId, groupName]) => {
                const bounds = getTelemetryLayoutGroupBounds(layout, groupId);
                if (!bounds) return null;
                return (
                  <div
                    key={groupId}
                    className="pointer-events-none absolute rounded-xl border border-dashed border-sky-400/70 bg-sky-400/5"
                    style={{
                      left: `${bounds.x * 100}%`,
                      top: `${bounds.y * 100}%`,
                      width: `${bounds.width * 100}%`,
                      height: `${bounds.height * 100}%`,
                    }}
                  >
                    <span className="absolute -top-5 left-2 rounded-t bg-sky-500/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {groupName}
                    </span>
                  </div>
                );
              })}
              {layout.map((item) => {
                const isIcon = item.type === 'icon';
                const isText = item.type === 'text';
                const isPip = item.type === 'pip';
                const [value, unit] =
                  isIcon || isText || isPip
                    ? ['—', '']
                    : (getTelemetryMetricValue(
                        previewPoint ?? null,
                        previewTelemetry,
                        item.metric
                      ) ?? ['', '']);
                const isSelected = selectedIds.includes(item.id);
                return (
                  <button
                    type="button"
                    key={item.id}
                    onPointerDown={(event) => beginDrag(event, item, 'move')}
                    onKeyDown={(event) => {
                      const stepX =
                        (event.ctrlKey || event.metaKey ? 10 : 1) *
                        KEYBOARD_PIXEL_STEP_X;
                      const stepY =
                        (event.ctrlKey || event.metaKey ? 10 : 1) *
                        KEYBOARD_PIXEL_STEP_Y;
                      const movement = {
                        ArrowLeft: [-stepX, 0],
                        ArrowRight: [stepX, 0],
                        ArrowUp: [0, -stepY],
                        ArrowDown: [0, stepY],
                      }[event.key];
                      if (!movement) return;
                      event.preventDefault();
                      event.stopPropagation();
                      moveWithKeyboard(item, movement[0], movement[1]);
                    }}
                    onClick={(event) => {
                      if (event.shiftKey || event.metaKey || event.ctrlKey)
                        return;
                      setSelectedIds([item.id]);
                    }}
                    className={`absolute flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border px-3 py-2 text-left text-white shadow-lg ${item.transparent === false ? 'bg-slate-950/85' : 'bg-transparent'} ${item.visible ? '' : 'opacity-35'} ${isSelected ? 'border-sky-400 ring-2 ring-sky-400/40' : item.border === true ? 'border-white/20' : 'border-transparent'}`}
                    style={{
                      left: `${item.x * 100}%`,
                      top: `${item.y * 100}%`,
                      width: `${item.width * 100}%`,
                      height: `${item.height * 100}%`,
                      fontSize: `${((item.fontSize ?? 32) / 1920) * 100}cqw`,
                      textAlign:
                        item.type === 'widget'
                          ? (item.valueAlign ?? 'left')
                          : undefined,
                    }}
                  >
                    {isPip ? (
                      <>
                        <PictureInPicture2 className="mx-auto h-1/2 w-1/2" />
                        <span className="mt-1 block truncate text-center text-[10px] font-semibold text-slate-300">
                          {item.name ?? t('telemetryLayout.pip')}
                        </span>
                      </>
                    ) : isText ? (
                      <span
                        className="block truncate text-center font-semibold"
                        style={{ fontSize: '1em' }}
                      >
                        {item.content}
                      </span>
                    ) : isIcon ? (
                      <>
                        <TelemetryLayoutIcon
                          name={item.icon}
                          className="mx-auto h-1/2 w-1/2"
                        />
                        <span className="mt-1 block truncate text-center text-[10px] font-semibold text-slate-300">
                          {item.name ?? item.icon}
                        </span>
                      </>
                    ) : item.variant && item.variant !== 'value' ? (
                      <TelemetrySpeedometer
                        metric={item.metric}
                        value={value}
                        unit={unit}
                        showUnit={item.showUnit !== false}
                        variant={item.variant}
                      />
                    ) : (
                      <>
                        {item.showLabel !== false && (
                          <span
                            className="block font-semibold uppercase tracking-wide text-slate-300"
                            style={{ fontSize: '0.35em' }}
                          >
                            {displayWidgetName(item.name ?? item.metric)}
                          </span>
                        )}
                        <span
                          className="mt-1 block truncate font-mono font-bold"
                          style={{ fontSize: '1em' }}
                        >
                          {formatTelemetryValue(value, '')}
                          {item.showUnit !== false && (
                            <span
                              className="ml-1 font-normal text-slate-300"
                              style={{ fontSize: '0.45em' }}
                            >
                              {unit}
                            </span>
                          )}
                        </span>
                      </>
                    )}
                    {isSelected && (
                      <span
                        className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-se-resize rounded-sm border border-white bg-sky-400"
                        onPointerDown={(event) =>
                          beginDrag(event, item, 'resize')
                        }
                      />
                    )}
                  </button>
                );
              })}
              <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-slate-950/70 px-2 py-1 text-[10px] text-slate-300">
                {t('telemetryLayout.dragHint')}
              </div>
            </div>
          </div>
        </div>
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-gray-800">
          <details
            open
            className="group mb-5 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-white [&::-webkit-details-marker]:hidden">
              {t('telemetryLayout.hierarchy')}
              <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {ungroupedItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`flex w-full items-center truncate rounded-md px-2 py-1.5 text-left text-xs transition ${selectedIds.includes(item.id) ? 'bg-sky-100 font-semibold text-sky-800 dark:bg-sky-950/50 dark:text-sky-200' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'}`}
                  aria-pressed={selectedIds.includes(item.id)}
                  onClick={(event) =>
                    selectFromHierarchy(
                      [item.id],
                      event.ctrlKey || event.metaKey
                    )
                  }
                >
                  <span className="mr-2 text-slate-400">
                    {item.type === 'widget'
                      ? '◈'
                      : item.type === 'icon'
                        ? '◆'
                        : item.type === 'text'
                          ? 'T'
                          : '▣'}
                  </span>
                  <span className="truncate">{hierarchyLabel(item)}</span>
                </button>
              ))}
              {groups.map(([groupId, groupName]) => {
                const children = layout.filter(
                  (item) => item.groupId === groupId
                );
                const isGroupSelected = children.every((item) =>
                  selectedIds.includes(item.id)
                );
                const isCollapsed = collapsedGroupIds.has(groupId);
                return (
                  <div key={groupId}>
                    <div className="flex items-center">
                      <button
                        type="button"
                        className={`flex min-w-0 flex-1 items-center truncate rounded-md px-2 py-1.5 text-left text-xs font-semibold transition ${isGroupSelected ? 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200' : 'text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-700'}`}
                        aria-pressed={isGroupSelected}
                        onClick={(event) =>
                          selectFromHierarchy(
                            children.map((item) => item.id),
                            event.ctrlKey || event.metaKey
                          )
                        }
                      >
                        <span className="truncate">{groupName}</span>
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-violet-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                        aria-label={t(
                          isCollapsed
                            ? 'telemetryLayout.expandGroup'
                            : 'telemetryLayout.collapseGroup'
                        )}
                        onClick={() =>
                          setCollapsedGroupIds((current) => {
                            const next = new Set(current);
                            if (next.has(groupId)) next.delete(groupId);
                            else next.add(groupId);
                            return next;
                          })
                        }
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                        />
                      </button>
                    </div>
                    {!isCollapsed && (
                      <div className="ml-4 border-l border-slate-200 pl-2 dark:border-slate-700">
                        {children.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={`flex w-full items-center truncate rounded-md px-2 py-1.5 text-left text-xs transition ${selectedIds.includes(item.id) ? 'bg-sky-100 font-semibold text-sky-800 dark:bg-sky-950/50 dark:text-sky-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                            aria-pressed={selectedIds.includes(item.id)}
                            onClick={(event) =>
                              selectFromHierarchy(
                                [item.id],
                                event.ctrlKey || event.metaKey
                              )
                            }
                          >
                            <span className="mr-2 text-slate-400">└</span>
                            <span className="truncate">
                              {hierarchyLabel(item)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <SlidersHorizontal className="h-4 w-4 text-sky-500" />
            {t('telemetryLayout.properties')}
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onPress={groupSelected}
              isDisabled={selectedIds.length < 2}
            >
              {t('telemetryLayout.group')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onPress={ungroupSelected}
              isDisabled={
                !selectedIds.some(
                  (id) => layout.find((item) => item.id === id)?.groupId
                )
              }
            >
              {t('telemetryLayout.ungroup')}
            </Button>
          </div>
          <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <span className="mr-1 self-center text-xs text-slate-500 dark:text-slate-400">
              {t('telemetryLayout.align')}
            </span>
            {(
              [
                ['left', AlignLeft, 'alignLeft'],
                ['center', AlignCenter, 'alignCenter'],
                ['right', AlignRight, 'alignRight'],
                ['top', AlignStartVertical, 'alignTop'],
                ['middle', AlignCenterVertical, 'alignMiddle'],
                ['bottom', AlignEndVertical, 'alignBottom'],
                ['row', AlignCenter, 'sameRow'],
                ['column', AlignCenterVertical, 'sameColumn'],
              ] as const
            ).map(([direction, Icon, label]) => (
              <Button
                key={direction}
                variant="ghost"
                size="sm"
                onPress={() => alignSelected(direction)}
                isDisabled={selectedIds.length < 2}
                aria-label={t(`telemetryLayout.${label}`)}
                title={t(`telemetryLayout.${label}`)}
              >
                <Icon className="h-4 w-4" />
              </Button>
            ))}
          </div>
          {selectedGroupId ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-violet-100 p-3 text-sm dark:bg-violet-950/40">
                <div className="font-semibold text-violet-900 dark:text-violet-100">
                  {t('telemetryLayout.selectedGroup')}
                </div>
                <div className="mt-1 text-violet-700 dark:text-violet-300">
                  {selectedGroupName}
                </div>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">
                  {t('telemetryLayout.groupName')}
                </span>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  value={selectedGroupName}
                  maxLength={100}
                  onChange={(event) =>
                    setLayout((current) =>
                      current.map((item) =>
                        item.groupId === selectedGroupId
                          ? { ...item, groupName: event.target.value }
                          : item
                      )
                    )
                  }
                />
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('telemetryLayout.groupSelectionHint')}
              </p>
            </div>
          ) : selected ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-100 p-3 text-sm font-medium dark:bg-slate-900">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{selected.id}</span>
                  <button
                    type="button"
                    className="rounded p-1 text-slate-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    onClick={removeSelectedField}
                    disabled={layout.length <= 1}
                    aria-label={t('telemetryLayout.removeField')}
                    title={t('telemetryLayout.removeField')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <details
                open
                className="group rounded-xl border border-slate-200 p-3 dark:border-slate-700"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-white [&::-webkit-details-marker]:hidden">
                  {t('telemetryLayout.content')}
                  <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-3 space-y-3">
                  <label className="block text-sm">
                    <span className="mb-1 block text-slate-600 dark:text-slate-300">
                      {t('telemetryLayout.name')}
                    </span>
                    <input
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                      value={selected.name ?? ''}
                      placeholder={selected.id}
                      maxLength={100}
                      onChange={(event) =>
                        updateItem(selected.id, { name: event.target.value })
                      }
                    />
                  </label>
                  {selected.groupId && (
                    <label className="block text-sm">
                      <span className="mb-1 block text-slate-600 dark:text-slate-300">
                        {t('telemetryLayout.groupName')}
                      </span>
                      <input
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                        value={selected.groupName ?? selected.groupId}
                        maxLength={100}
                        onChange={(event) =>
                          setLayout((current) =>
                            current.map((item) =>
                              item.groupId === selected.groupId
                                ? { ...item, groupName: event.target.value }
                                : item
                            )
                          )
                        }
                      />
                    </label>
                  )}
                  {selected.type === 'icon' ? (
                    <label className="block text-sm">
                      <span className="mb-1 block text-slate-600 dark:text-slate-300">
                        {t('telemetryLayout.icon')}
                      </span>
                      <select
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                        value={selected.icon}
                        onChange={(event) =>
                          updateItem(selected.id, {
                            icon: event.target
                              .value as FlightTelemetryIconLayout['icon'],
                          })
                        }
                      >
                        {[
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
                        ].map((icon) => (
                          <option key={icon} value={icon}>
                            {icon}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : selected.type === 'text' ? (
                    <label className="block text-sm">
                      <span className="mb-1 block text-slate-600 dark:text-slate-300">
                        {t('telemetryLayout.text')}
                      </span>
                      <textarea
                        className="min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                        value={selected.content}
                        minLength={1}
                        maxLength={500}
                        onChange={(event) =>
                          updateItem(selected.id, {
                            content: event.target.value,
                          })
                        }
                      />
                    </label>
                  ) : selected.type === 'pip' ? (
                    <label className="block text-sm">
                      <span className="mb-1 block text-slate-600 dark:text-slate-300">
                        {t('telemetryLayout.pipAction')}
                      </span>
                      <select
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                        value={selected.action}
                        onChange={(event) =>
                          updateItem(selected.id, {
                            action: event.target.value as 'switch_video',
                          })
                        }
                      >
                        <option value="switch_video">
                          {t('telemetryLayout.actionSwitchVideo')}
                        </option>
                      </select>
                    </label>
                  ) : (
                    <label className="block text-sm">
                      <span className="mb-1 block text-slate-600 dark:text-slate-300">
                        {t('telemetryLayout.metric')}
                      </span>
                      <select
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                        value={selected.metric}
                        onChange={(event) =>
                          updateItem(selected.id, {
                            metric: event.target.value as Metric,
                          })
                        }
                      >
                        {METRICS.map((metric) => (
                          <option key={metric} value={metric}>
                            {t(`flights.${METRIC_LABELS[metric]}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {selected.type === 'widget' && (
                    <label className="block text-sm">
                      <span className="mb-1 block text-slate-600 dark:text-slate-300">
                        {t('telemetryLayout.widgetModel')}
                      </span>
                      <select
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                        value={selected.variant ?? 'value'}
                        onChange={(event) =>
                          updateItem(selected.id, {
                            variant: event.target
                              .value as TelemetryWidgetVariant,
                          })
                        }
                      >
                        {(
                          [
                            'value',
                            'speedometer',
                            'arc',
                            'radial',
                            'digital',
                            'compass',
                            'bar',
                            'chart',
                            'asi',
                          ] as const
                        ).map((variant) => (
                          <option key={variant} value={variant}>
                            {t(`telemetryLayout.widgetModels.${variant}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </details>
              <details
                open
                className="group rounded-xl border border-slate-200 p-3 dark:border-slate-700"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-white [&::-webkit-details-marker]:hidden">
                  {t('telemetryLayout.appearance')}
                  <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-3 space-y-3">
                  {selected.type === 'widget' && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected.showLabel !== false}
                        onChange={(event) =>
                          updateItem(selected.id, {
                            showLabel: event.target.checked,
                          })
                        }
                      />
                      {t('telemetryLayout.showLabel')}
                    </label>
                  )}
                  {selected.type === 'widget' && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected.showUnit !== false}
                        onChange={(event) =>
                          updateItem(selected.id, {
                            showUnit: event.target.checked,
                          })
                        }
                      />
                      {t('telemetryLayout.showUnit')}
                    </label>
                  )}
                  {(selected.type === 'widget' || selected.type === 'text') && (
                    <label className="block text-sm">
                      <span className="mb-1 block text-slate-600 dark:text-slate-300">
                        {t('telemetryLayout.fontSize')}
                      </span>
                      <input
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-right dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                        type="number"
                        min="8"
                        max="160"
                        step="1"
                        value={selected.fontSize ?? 32}
                        onChange={(event) =>
                          updateItem(selected.id, {
                            fontSize: Math.min(
                              Number(event.target.value) || 0,
                              160
                            ),
                          })
                        }
                        onBlur={() =>
                          updateItem(selected.id, {
                            fontSize: clamp(selected.fontSize ?? 32, 8, 160),
                          })
                        }
                      />
                    </label>
                  )}
                  {selected.type === 'widget' && (
                    <label className="block text-sm">
                      <span className="mb-1 block text-slate-600 dark:text-slate-300">
                        {t('telemetryLayout.valueAlignment')}
                      </span>
                      <select
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                        value={selected.valueAlign ?? 'left'}
                        onChange={(event) =>
                          updateItem(selected.id, {
                            valueAlign: event.target.value as
                              | 'left'
                              | 'center'
                              | 'right',
                          })
                        }
                      >
                        <option value="left">
                          {t('telemetryLayout.alignLeft')}
                        </option>
                        <option value="center">
                          {t('telemetryLayout.alignCenter')}
                        </option>
                        <option value="right">
                          {t('telemetryLayout.alignRight')}
                        </option>
                      </select>
                    </label>
                  )}
                </div>
              </details>
              {selected.type === 'widget' && (
                <details className="group rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-white [&::-webkit-details-marker]:hidden">
                    {t('telemetryLayout.interactions')}
                    <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-3 space-y-3">
                    <label className="block text-sm">
                      <span className="mb-1 block text-slate-600 dark:text-slate-300">
                        {t('telemetryLayout.clickAction')}
                      </span>
                      <select
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                        value={selected.clickAction ?? 'cycle_metric'}
                        onChange={(event) =>
                          updateItem(selected.id, {
                            clickAction: event.target.value as
                              | 'none'
                              | 'cycle_metric',
                          })
                        }
                      >
                        <option value="none">
                          {t('telemetryLayout.actionNone')}
                        </option>
                        <option value="cycle_metric">
                          {t('telemetryLayout.actionCycleMetric')}
                        </option>
                      </select>
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-slate-600 dark:text-slate-300">
                        {t('telemetryLayout.longPressAction')}
                      </span>
                      <select
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                        value={selected.longPressAction ?? 'none'}
                        onChange={(event) =>
                          updateItem(selected.id, {
                            longPressAction: event.target.value as
                              | 'none'
                              | 'cycle_metric',
                          })
                        }
                      >
                        <option value="none">
                          {t('telemetryLayout.actionNone')}
                        </option>
                        <option value="cycle_metric">
                          {t('telemetryLayout.actionCycleMetric')}
                        </option>
                      </select>
                    </label>
                  </div>
                </details>
              )}
              <details className="group rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-white [&::-webkit-details-marker]:hidden">
                  {t('telemetryLayout.layout')}
                  <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-3 space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.visible}
                      onChange={(event) =>
                        updateItem(selected.id, {
                          visible: event.target.checked,
                        })
                      }
                    />
                    {t('telemetryLayout.visible')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.transparent !== false}
                      onChange={(event) =>
                        updateItem(selected.id, {
                          transparent: event.target.checked,
                        })
                      }
                    />
                    {t('telemetryLayout.transparentBackground')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.border === true}
                      onChange={(event) =>
                        updateItem(selected.id, {
                          border: event.target.checked,
                        })
                      }
                    />
                    {t('telemetryLayout.showBorder')}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        ['x', selected.x],
                        ['y', selected.y],
                        ['width', selected.width],
                        ['height', selected.height],
                      ] as const
                    ).map(([name, value]) => (
                      <label key={name} className="text-sm">
                        <span className="mb-1 block text-slate-600 dark:text-slate-300">
                          {t(`telemetryLayout.${name}`)} %
                        </span>
                        <input
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-right dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={Math.round(value * 100)}
                          onChange={(event) => {
                            const next = clamp(
                              Number(event.target.value) / 100,
                              0,
                              1
                            );
                            if (name === 'x') {
                              updateItem(selected.id, {
                                x: clamp(next, 0, 1 - selected.width),
                              });
                            } else if (name === 'y') {
                              updateItem(selected.id, {
                                y: clamp(next, 0, 1 - selected.height),
                              });
                            } else if (name === 'width') {
                              updateItem(selected.id, {
                                width: clamp(next, 0.05, 1 - selected.x),
                              });
                            } else {
                              updateItem(selected.id, {
                                height: clamp(next, 0.05, 1 - selected.y),
                              });
                            }
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-900">
                    <span className="text-slate-600 dark:text-slate-300">
                      {t('telemetryLayout.pixelSize')}
                    </span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {Math.round(selected.width * 1920)} ×{' '}
                      {Math.round(selected.height * 1080)} px
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Grip className="h-4 w-4" />
                    {t('telemetryLayout.resizeHint')}
                  </div>
                </div>
              </details>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {t('telemetryLayout.selectWidget')}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
