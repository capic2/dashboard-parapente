import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FLIGHT_TELEMETRY_LAYOUT,
  alignTelemetryLayoutItems,
  ensureInteractiveDynamicTelemetryWidgets,
  parseTelemetryLayoutXml,
  serializeTelemetryLayoutXml,
} from './flightTelemetryLayout';
import type { FlightTelemetryWidgetLayout } from './flightTelemetryLayout';
import { getTelemetryMetricValue } from './telemetryMetrics';
import type { FlightTelemetryData } from '../../../hooks/flights/useFlightTelemetry';

describe('flight telemetry layout XML', () => {
  it('adds missing dynamic widgets without removing saved aggregate widgets', () => {
    const layout: FlightTelemetryWidgetLayout[] = [
      {
        id: 'heart-rate-min',
        type: 'widget',
        metric: 'heart_rate_min',
        x: 0.7,
        y: 0.1,
        width: 0.1,
        height: 0.1,
        visible: true,
      },
      {
        id: 'speed',
        type: 'widget',
        metric: 'speed',
        x: 0.8,
        y: 0.1,
        width: 0.1,
        height: 0.1,
        visible: true,
      },
    ];

    const result = ensureInteractiveDynamicTelemetryWidgets(layout);

    expect(result.map((item) => item.type === 'widget' && item.metric)).toEqual(
      [
        'heart_rate_min',
        'speed',
        'altitude',
        'vario',
        'distance',
        'heart_rate',
        'total_gain',
        'total_loss',
      ]
    );
    expect(result.find((item) => item.id === 'speed')).toEqual(layout[1]);
  });

  it('moves legacy default dynamic widgets to the right overlay column', () => {
    const result = ensureInteractiveDynamicTelemetryWidgets([
      ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT,
    ]);

    expect(result.find((item) => item.id === 'top-left')).toMatchObject({
      x: 0.82,
      y: 0.14,
    });
    expect(result.find((item) => item.id === 'bottom-left')).toMatchObject({
      x: 0.82,
      y: 0.5,
    });
  });

  it('round-trips normalized widget positions and metrics', () => {
    const layout: FlightTelemetryWidgetLayout[] =
      DEFAULT_FLIGHT_TELEMETRY_LAYOUT.map((widget, index) => ({
        ...widget,
        x: 0.1 + index / 10,
        metric: index === 0 ? 'power' : widget.metric,
      }));

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(
      layout.map((widget) => ({ ...widget, x: Number(widget.x.toFixed(4)) }))
    );
  });

  it('falls back to the default layout for malformed XML', () => {
    expect(parseTelemetryLayoutXml('<broken')).toEqual(
      DEFAULT_FLIGHT_TELEMETRY_LAYOUT
    );
  });

  it('round-trips an added telemetry field', () => {
    const layout: FlightTelemetryWidgetLayout[] = [
      ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT,
      {
        id: 'field-extra',
        type: 'widget',
        metric: 'heading',
        x: 0.4,
        y: 0.4,
        width: 0.16,
        height: 0.1,
        visible: true,
      },
    ];

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(layout);
  });

  it('loads layouts containing more than sixteen elements', () => {
    const layout = Array.from({ length: 22 }, (_, index) => ({
      ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT[index % 4],
      id: `element-${index}`,
      x: 0.01,
      y: 0.01,
    }));

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toHaveLength(22);
  });

  it('round-trips icons and group membership', () => {
    const layout = [
      {
        ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT[0],
        groupId: 'flight-info',
      },
      {
        id: 'wind-icon',
        type: 'icon' as const,
        icon: 'wind' as const,
        x: 0.4,
        y: 0.4,
        width: 0.06,
        height: 0.06,
        visible: true,
        groupId: 'flight-info',
      },
    ];

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(layout);
  });

  it('round-trips text elements', () => {
    const layout = [
      {
        id: 'title',
        type: 'text' as const,
        name: 'Titre',
        content: 'Vol du matin',
        textAlign: 'right' as const,
        transparent: true,
        border: false,
        x: 0.2,
        y: 0.3,
        width: 0.3,
        height: 0.08,
        visible: true,
      },
    ];

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(layout);
  });

  it('round-trips explicit widget background and border styles', () => {
    const layout = [
      {
        ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT[0],
        transparent: false,
        border: true,
      },
    ];

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(layout);
  });

  it('round-trips a text element font size', () => {
    const layout = [
      {
        id: 'title',
        type: 'text' as const,
        content: 'Vol du matin',
        fontSize: 48,
        x: 0.2,
        y: 0.3,
        width: 0.3,
        height: 0.08,
        visible: true,
      },
    ];

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(layout);
  });

  it('round-trips a widget without its metric label', () => {
    const layout = [
      {
        ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT[0],
        showLabel: false,
      },
    ];

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(layout);
  });

  it('round-trips a widget without its unit', () => {
    const layout = [
      {
        ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT[0],
        showUnit: false,
      },
    ];

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(layout);
  });

  it('round-trips a widget font size', () => {
    const layout = [
      {
        ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT[0],
        fontSize: 48,
      },
    ];

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(layout);
  });

  it('round-trips widget click and long-press actions', () => {
    const layout = [
      {
        ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT[0],
        clickAction: 'none' as const,
        longPressAction: 'cycle_metric' as const,
      },
    ];

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(layout);
  });

  it('round-trips the global background image', () => {
    const layout = [
      {
        ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT[0],
      },
    ] as typeof DEFAULT_FLIGHT_TELEMETRY_LAYOUT & {
      backgroundImage?: string;
    };
    layout.backgroundImage = 'data:image/png;base64,ZmFrZQ==';

    const parsed = parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout));

    expect(parsed.backgroundImage).toBe(layout.backgroundImage);
  });

  it('serializes an explicitly provided background image', () => {
    const xml = serializeTelemetryLayoutXml(
      [DEFAULT_FLIGHT_TELEMETRY_LAYOUT[0]],
      { backgroundImage: 'data:image/png;base64,ZmFrZQ==' }
    );

    expect(parseTelemetryLayoutXml(xml).backgroundImage).toBe(
      'data:image/png;base64,ZmFrZQ=='
    );
  });

  it('round-trips a graphical speedometer widget', () => {
    const layout = [
      {
        ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT[0],
        variant: 'speedometer' as const,
        metric: 'speed' as const,
      },
    ];

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(layout);
  });

  it('round-trips a video PiP component and its switch action', () => {
    const layout = [
      {
        id: 'video-pip',
        type: 'pip' as const,
        name: 'Caméra embarquée',
        action: 'switch_video' as const,
        x: 0.02,
        y: 0.78,
        width: 0.18,
        height: 0.18,
        visible: true,
      },
    ];

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(layout);
  });

  it.each([
    'arc',
    'radial',
    'digital',
    'compass',
    'bar',
    'chart',
    'asi',
  ] as const)('round-trips the %s gauge model', (variant) => {
    const layout = [
      {
        ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT[0],
        variant,
        metric: 'speed' as const,
      },
    ];

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(layout);
  });

  it('round-trips widget value alignment', () => {
    const layout = [
      {
        ...DEFAULT_FLIGHT_TELEMETRY_LAYOUT[0],
        valueAlign: 'right' as const,
      },
    ];

    expect(
      parseTelemetryLayoutXml(serializeTelemetryLayoutXml(layout))
    ).toEqual(layout);
  });

  it('evaluates the calculated fields used by the 3840 GoPro layout', () => {
    const data = {
      points: [
        {
          timestamp: 1_700_000_000,
          lat: 0,
          lon: 0,
          elevation: 1200,
          segment: 0,
          vario_ms: 1,
          heart_rate: 100,
        },
        {
          timestamp: 1_700_001_000,
          lat: 0,
          lon: 0,
          elevation: 1250,
          segment: 0,
          vario_ms: -2,
          heart_rate: 140,
        },
        {
          timestamp: 1_700_002_000,
          lat: 0,
          lon: 0,
          elevation: 1230,
          segment: 0,
          vario_ms: 0,
          heart_rate: 120,
        },
      ],
    } as FlightTelemetryData;
    const point = data.points[1];

    expect(getTelemetryMetricValue(point, data, 'start_altitude')).toEqual([
      1200,
      'm',
    ]);
    expect(getTelemetryMetricValue(point, data, 'altitude_min')).toEqual([
      1200,
      'm',
    ]);
    expect(getTelemetryMetricValue(point, data, 'altitude_max')).toEqual([
      1250,
      'm',
    ]);
    expect(getTelemetryMetricValue(point, data, 'total_gain')).toEqual([
      50,
      'm',
    ]);
    expect(getTelemetryMetricValue(point, data, 'total_loss')).toEqual([
      20,
      'm',
    ]);
    expect(getTelemetryMetricValue(point, data, 'vario_min')).toEqual([
      -2,
      'm/s',
    ]);
    expect(getTelemetryMetricValue(point, data, 'heart_rate_max')).toEqual([
      140,
      'bpm',
    ]);
  });

  it('keeps elevation changes across telemetry segments like GoPro overlay', () => {
    const data = {
      points: [
        { timestamp: 1, lat: 0, lon: 0, elevation: 100, segment: 0 },
        { timestamp: 2, lat: 0, lon: 0, elevation: 140, segment: 0 },
        { timestamp: 3, lat: 0, lon: 0, elevation: 110, segment: 1 },
        { timestamp: 4, lat: 0, lon: 0, elevation: 150, segment: 1 },
      ],
    } as FlightTelemetryData;

    expect(getTelemetryMetricValue(data.points[3], data, 'total_gain')).toEqual(
      [80, 'm']
    );
    expect(getTelemetryMetricValue(data.points[3], data, 'total_loss')).toEqual(
      [30, 'm']
    );
  });
});

describe('flight telemetry layout alignment', () => {
  it('requires multiple selected items for component alignment', () => {
    const layout = [
      {
        id: 'title',
        type: 'text' as const,
        content: 'Vol du matin',
        x: 0.2,
        y: 0.3,
        width: 0.3,
        height: 0.08,
        visible: true,
      },
    ];

    expect(alignTelemetryLayoutItems(layout, ['title'], 'left')).toEqual(
      layout
    );
  });

  it('keeps same-row and same-column actions for multi-selection only', () => {
    const layout = [
      {
        id: 'title',
        type: 'text' as const,
        content: 'Vol du matin',
        x: 0.2,
        y: 0.3,
        width: 0.3,
        height: 0.08,
        visible: true,
      },
    ];

    expect(alignTelemetryLayoutItems(layout, ['title'], 'row')).toEqual(layout);
    expect(alignTelemetryLayoutItems(layout, ['title'], 'column')).toEqual(
      layout
    );
  });

  it('uses the first selected item as the row and column reference', () => {
    const layout = [
      {
        id: 'first-in-layout',
        type: 'text' as const,
        content: 'Premier',
        x: 0.1,
        y: 0.2,
        width: 0.1,
        height: 0.05,
        visible: true,
      },
      {
        id: 'selected-first',
        type: 'text' as const,
        content: 'Sélectionné en premier',
        x: 0.6,
        y: 0.7,
        width: 0.2,
        height: 0.1,
        visible: true,
      },
    ];

    expect(
      alignTelemetryLayoutItems(
        layout,
        ['selected-first', 'first-in-layout'],
        'row'
      ).map((item) => item.y)
    ).toEqual([0.7, 0.7]);
    expect(
      alignTelemetryLayoutItems(
        layout,
        ['selected-first', 'first-in-layout'],
        'column'
      ).map((item) => item.x)
    ).toEqual([0.6, 0.6]);
    expect(
      alignTelemetryLayoutItems(
        layout,
        ['selected-first', 'first-in-layout'],
        'right'
      ).map((item) => Number(item.x.toFixed(3)))
    ).toEqual([0.7, 0.6]);
    expect(
      alignTelemetryLayoutItems(
        layout,
        ['selected-first', 'first-in-layout'],
        'center'
      ).map((item) => Number(item.x.toFixed(3)))
    ).toEqual([0.65, 0.6]);
    expect(
      alignTelemetryLayoutItems(
        layout,
        ['selected-first', 'first-in-layout'],
        'top'
      ).map((item) => item.y)
    ).toEqual([0.7, 0.7]);
    expect(
      alignTelemetryLayoutItems(
        layout,
        ['selected-first', 'first-in-layout'],
        'bottom'
      ).map((item) => Number(item.y.toFixed(3)))
    ).toEqual([0.75, 0.7]);
    expect(
      alignTelemetryLayoutItems(
        layout,
        ['selected-first', 'first-in-layout'],
        'middle'
      ).map((item) => Number(item.y.toFixed(3)))
    ).toEqual([0.725, 0.7]);
  });
});
