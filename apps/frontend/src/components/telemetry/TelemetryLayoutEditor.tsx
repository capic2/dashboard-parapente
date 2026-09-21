import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@dashboard-parapente/design-system';
import {
  Download,
  Grip,
  Plus,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { useFlightTelemetry } from '../../hooks/flights/useFlightTelemetry';
import {
  defaultTelemetryLayout,
  useResetTelemetryLayout,
  useSaveTelemetryLayout,
  useTelemetryLayout,
} from '../../hooks/flights/useTelemetryLayout';
import {
  serializeTelemetryLayoutXml,
  type FlightTelemetryIconLayout,
  type FlightTelemetryLayoutItem,
  type FlightTelemetryTextLayout,
} from '../flights/details/flightTelemetryLayout';
import { TelemetryLayoutIcon } from './TelemetryLayoutIcon';
import {
  METRIC_KEYS as METRICS,
  METRIC_LABELS,
  formatTelemetryValue,
  getTelemetryMetricValue,
  type MetricKey as Metric,
} from '../flights/details/telemetryMetrics';

type DragMode = 'move' | 'resize';

const MAX_WIDGETS = 16;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function TelemetryLayoutEditor({ flightId }: { flightId?: string }) {
  const { t } = useTranslation();
  const layoutQuery = useTelemetryLayout(flightId);
  const telemetryQuery = useFlightTelemetry(flightId ?? '', Boolean(flightId));
  const saveLayout = useSaveTelemetryLayout(flightId);
  const resetLayout = useResetTelemetryLayout(flightId ?? '');
  const canvasRef = useRef<HTMLDivElement>(null);
  const widgetIdCounter = useRef(0);
  const [layout, setLayout] = useState<FlightTelemetryLayoutItem[]>(
    defaultTelemetryLayout
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(
    layout[0]?.id ? [layout[0].id] : []
  );
  const [drag, setDrag] = useState<{
    mode: DragMode;
    startX: number;
    startY: number;
    items: FlightTelemetryLayoutItem[];
  } | null>(null);

  useEffect(() => {
    if (layoutQuery.data?.layout) {
      setLayout(layoutQuery.data.layout);
      setSelectedIds(
        layoutQuery.data.layout[0]?.id ? [layoutQuery.data.layout[0].id] : []
      );
    }
  }, [layoutQuery.data?.layout]);

  const selected = layout.find((item) => item.id === selectedIds[0]) ?? null;
  const previewPoint = telemetryQuery.data?.points[0];

  const addField = () => {
    if (layout.length >= MAX_WIDGETS) return;
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
    if (layout.length >= MAX_WIDGETS) return;
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

  const addText = () => {
    if (layout.length >= MAX_WIDGETS) return;
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
    const groupId = `group-${Date.now()}-${widgetIdCounter.current++}`;
    const groupName = `Group ${widgetIdCounter.current}`;
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
    const groupItems = item.groupId
      ? layout.filter((candidate) => candidate.groupId === item.groupId)
      : selectedIds.includes(item.id)
        ? layout.filter((candidate) => selectedIds.includes(candidate.id))
        : [item];
    const movingItems = mode === 'resize' ? [item] : groupItems;
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
      setLayout((current) =>
        current.map((item) => {
          const original = drag.items.find(
            (candidate) => candidate.id === item.id
          );
          if (!original) return item;
          return {
            ...item,
            x: clamp(original.x + dx, 0, 1 - original.width),
            y: clamp(original.y + dy, 0, 1 - original.height),
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

  const downloadXml = () => {
    const blob = new Blob([serializeTelemetryLayoutXml(layout)], {
      type: 'application/xml',
    });
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onPress={addField}
            isDisabled={layout.length >= MAX_WIDGETS}
          >
            <Plus className="h-4 w-4" />
            {t('telemetryLayout.addField')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onPress={addIcon}
            isDisabled={layout.length >= MAX_WIDGETS}
          >
            <Plus className="h-4 w-4" />
            {t('telemetryLayout.addIcon')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onPress={addText}
            isDisabled={layout.length >= MAX_WIDGETS}
          >
            <Plus className="h-4 w-4" />
            {t('telemetryLayout.addText')}
          </Button>
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
            onPress={() => void saveLayout.mutateAsync(layout)}
            isDisabled={saveLayout.isPending}
          >
            <Save className="h-4 w-4" />
            {saveLayout.isPending
              ? t('telemetryLayout.saving')
              : t('telemetryLayout.save')}
          </Button>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="rounded-2xl border border-slate-700 bg-slate-950 p-3 shadow-xl">
          <div
            ref={canvasRef}
            className="relative mx-auto aspect-video max-w-5xl overflow-hidden rounded-lg border border-slate-700 bg-[radial-gradient(circle_at_50%_35%,#1e3a5f,#090f1b_65%)] select-none"
            style={{ containerType: 'inline-size' }}
            onPointerMove={moveDrag}
            onPointerUp={() => setDrag(null)}
            onPointerCancel={() => setDrag(null)}
            aria-label={t('telemetryLayout.canvasLabel')}
          >
            <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(#94a3b8_1px,transparent_1px),linear-gradient(90deg,#94a3b8_1px,transparent_1px)] [background-size:10%_10%]" />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-slate-400/20" />
            <div className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-slate-400/20" />
            {layout.map((item) => {
              const isIcon = item.type === 'icon';
              const isText = item.type === 'text';
              const [value, unit] =
                isIcon || isText
                  ? ['—', '']
                  : (getTelemetryMetricValue(
                      previewPoint ?? null,
                      telemetryQuery.data,
                      item.metric
                    ) ?? ['—', '']);
              const isSelected = selectedIds.includes(item.id);
              return (
                <button
                  type="button"
                  key={item.id}
                  onPointerDown={(event) => beginDrag(event, item, 'move')}
                  onClick={(event) => {
                    if (event.shiftKey || event.metaKey || event.ctrlKey)
                      return;
                    const ids = item.groupId
                      ? layout
                          .filter(
                            (candidate) => candidate.groupId === item.groupId
                          )
                          .map((candidate) => candidate.id)
                      : [item.id];
                    setSelectedIds(ids);
                  }}
                  className={`absolute flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border px-3 py-2 text-left text-white shadow-lg ${item.transparent ? 'bg-transparent' : 'bg-slate-950/85'} ${item.visible ? '' : 'opacity-35'} ${isSelected ? 'border-sky-400 ring-2 ring-sky-400/40' : item.border === false ? 'border-transparent' : 'border-white/20'}`}
                  style={{
                    left: `${item.x * 100}%`,
                    top: `${item.y * 100}%`,
                    width: `${item.width * 100}%`,
                    height: `${item.height * 100}%`,
                    fontSize: `${((item.fontSize ?? 32) / 1920) * 100}cqw`,
                  }}
                >
                  {isText ? (
                    <span className="block truncate text-center text-sm font-semibold">
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
                  ) : (
                    <>
                      {item.showLabel !== false && (
                        <span
                          className="block font-semibold uppercase tracking-wide text-slate-300"
                          style={{ fontSize: '0.35em' }}
                        >
                          {item.name ?? item.metric}
                        </span>
                      )}
                      <span
                        className="mt-1 block truncate font-mono font-bold"
                        style={{ fontSize: '1em' }}
                      >
                        {formatTelemetryValue(value)}
                        <span
                          className="ml-1 font-normal text-slate-300"
                          style={{ fontSize: '0.45em' }}
                        >
                          {unit}
                        </span>
                      </span>
                    </>
                  )}
                  {item.groupId && (
                    <span className="mt-auto text-[9px] text-sky-300">
                      {t('telemetryLayout.grouped')}
                    </span>
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
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-gray-800">
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
          {selected ? (
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
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">
                  {t('telemetryLayout.name')}
                </span>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  value={selected.name ?? ''}
                  placeholder={selected.id}
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
                    maxLength={500}
                    onChange={(event) =>
                      updateItem(selected.id, { content: event.target.value })
                    }
                  />
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
                        fontSize: clamp(Number(event.target.value), 8, 160),
                      })
                    }
                  />
                </label>
              )}
              {selected.type === 'widget' && (
                <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {t('telemetryLayout.interactions')}
                  </p>
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
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.visible}
                  onChange={(event) =>
                    updateItem(selected.id, { visible: event.target.checked })
                  }
                />
                {t('telemetryLayout.visible')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.transparent ?? false}
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
                  checked={selected.border !== false}
                  onChange={(event) =>
                    updateItem(selected.id, { border: event.target.checked })
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
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Grip className="h-4 w-4" />
                {t('telemetryLayout.resizeHint')}
              </div>
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
