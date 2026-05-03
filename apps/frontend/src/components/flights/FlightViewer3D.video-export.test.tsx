import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  apiGet,
  apiPost,
  invalidateQueries,
  mockFlight,
  viewerInstances,
  viewerOptions,
} = vi.hoisted(() => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    invalidateQueries: vi.fn(),
    viewerInstances: [] as {
      render: ReturnType<typeof vi.fn>;
      scene: {
        requestRender: ReturnType<typeof vi.fn>;
        render: ReturnType<typeof vi.fn>;
      };
    }[],
    viewerOptions: [] as unknown[],
    mockFlight: {
      gpx_file_path: 'sample.gpx',
      video_export_status: null as string | null,
      video_export_job_id: null as string | null,
      video_file_path: null as string | null,
      site: null,
    },
  }));

vi.mock('cesium', () => {
  class Cartesian3 {
    constructor(
      public x = 0,
      public y = 0,
      public z = 0
    ) {}

    static fromDegrees() {
      return new Cartesian3();
    }

    static fromRadians() {
      return new Cartesian3();
    }
  }

  class Cartographic {
    longitude = 0;
    latitude = 0;
    height = 100;

    static fromCartesian() {
      return new Cartographic();
    }
  }

  class Color {
    static RED = new Color();
    static YELLOW = new Color();
    static BLACK = new Color();
    static WHITE = new Color();
    static GREEN = new Color();

    withAlpha() {
      return this;
    }
  }

  class Viewer {
    scene = {
      globe: {
        tilesLoaded: true,
        getHeight: () => 0,
      },
      requestRender: vi.fn(),
      render: vi.fn(),
      screenSpaceCameraController: { enableCollisionDetection: true },
      postProcessStages: { ambientOcclusion: { enabled: false, uniforms: {} } },
      light: { intensity: 1 },
    };
    clock = { currentTime: {}, shouldAnimate: false };
    camera = {
      position: {},
      setView: vi.fn(),
      moveBackward: vi.fn(),
      flyToBoundingSphere: vi.fn(),
    };
    entities = {
      add: vi.fn(() => ({})),
      contains: vi.fn(() => false),
      remove: vi.fn(),
    };
    shadows = false;
    terrainShadows = 0;
    render = vi.fn();

    constructor(_container: Element, options: unknown) {
      viewerOptions.push(options);
      viewerInstances.push(this);
    }

    isDestroyed() {
      return false;
    }

    destroy() {
      return undefined;
    }
  }

  return {
    ArcType: { NONE: 0 },
    BoundingSphere: { fromPoints: () => ({ radius: 100 }) },
    Cartesian2: class Cartesian2 {
      constructor(
        public x = 0,
        public y = 0
      ) {}
    },
    Cartesian3,
    Cartographic,
    CallbackProperty: class CallbackProperty {
      constructor(
        public callback: () => unknown,
        public isConstant: boolean
      ) {}
    },
    Color,
    ConstantPositionProperty: class ConstantPositionProperty {
      setValue = vi.fn();
    },
    Entity: class Entity {
      id = 'entity';
    },
    HeadingPitchRange: class HeadingPitchRange {
      constructor(
        public heading: number,
        public pitch: number,
        public range: number
      ) {}
    },
    HorizontalOrigin: { CENTER: 0 },
    Ion: { defaultAccessToken: '' },
    JulianDate: { fromIso8601: () => ({}) },
    LabelStyle: { FILL_AND_OUTLINE: 0 },
    Math: { toRadians: (value: number) => (value * globalThis.Math.PI) / 180 },
    sampleTerrainMostDetailed: vi.fn(),
    ShadowMode: { ENABLED: 1, DISABLED: 0 },
    Terrain: { fromWorldTerrain: () => ({}) },
    VerticalOrigin: { BOTTOM: 0 },
    Viewer,
  };
});

vi.mock('@dashboard-parapente/design-system', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('react-aria-components', () => ({
  Disclosure: ({
    children,
  }: {
    children: (state: { isExpanded: boolean }) => React.ReactNode;
  }) => <div>{children({ isExpanded: true })}</div>,
  DisclosurePanel: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'flights.viewer.defaultTitle': 'Flight viewer',
        'flights.viewer.videoExportMode': 'Export mode',
        'flights.viewer.videoModeManualFast': 'Fast smooth',
        'flights.viewer.videoModeManual': 'Max quality',
        'flights.viewer.videoModeManualFastHint': 'Fast hint',
        'flights.viewer.videoModeManualHint': 'Manual hint',
        'flights.viewer.generateVideo': 'Generate video',
        'flights.viewer.downloadVideo': 'Download video',
        'flights.viewer.videoSection': 'Video',
      })[key] ?? key,
  }),
  withTranslation: () => (Component: unknown) => Component,
}));

vi.mock('../../hooks/flights/useFlightGPX', () => ({
  useFlightGPX: () => ({
    data: {
      coordinates: [
        { lat: 45, lon: 6, elevation: 1000, timestamp: 0 },
        { lat: 45.1, lon: 6.1, elevation: 1100, timestamp: 1000 },
      ],
      flight_duration_seconds: 1,
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../../hooks/flights/useFlight', () => ({
  useFlight: () => ({
    data: mockFlight,
  }),
}));

vi.mock('../../hooks/flights/useVideoExportStatus', () => ({
  formatEta: () => null,
  useVideoExportStatus: () => ({ status: null }),
}));

vi.mock('../../lib/api', () => ({
  api: {
    get: apiGet,
    post: apiPost,
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}));

import { FlightViewer3D } from './FlightViewer3D';

describe('FlightViewer3D video export mode', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalClientHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'clientHeight'
  );
  const originalClientWidth = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'clientWidth'
  );

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      value: 768,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 1024,
    });
    apiPost.mockResolvedValue(undefined);
    apiGet.mockReset();
    apiPost.mockClear();
    invalidateQueries.mockClear();
    viewerInstances.length = 0;
    viewerOptions.length = 0;
    mockFlight.video_export_status = null;
    mockFlight.video_export_job_id = null;
    mockFlight.video_file_path = null;
    window._exportMode = undefined;
    window._setExportFrame = undefined;
  });

  afterEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: originalRevokeObjectURL,
    });
    if (originalClientHeight) {
      Object.defineProperty(
        HTMLElement.prototype,
        'clientHeight',
        originalClientHeight
      );
    }
    if (originalClientWidth) {
      Object.defineProperty(
        HTMLElement.prototype,
        'clientWidth',
        originalClientWidth
      );
    }
    window._exportMode = undefined;
    window._setExportFrame = undefined;
  });

  it('starts fast smooth export by default and shows its hint', async () => {
    render(<FlightViewer3D flightId="flight-1" />);

    expect(screen.getByText('Fast hint')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Generate video/ }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('flights/flight-1/export-video', {
        searchParams: { mode: 'manual_fast' },
      });
    });
  });

  it('hides viewer controls in export-only mode', () => {
    render(<FlightViewer3D flightId="flight-1" exportOnly />);

    expect(screen.getByTestId('flight-viewer-root')).toHaveAttribute(
      'style',
      'height: 100%;'
    );
    expect(screen.getByTestId('flight-viewer-root')).toHaveClass(
      'flight-viewer-export-only'
    );
    expect(screen.queryByText('Fast hint')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Generate video/ })
    ).not.toBeInTheDocument();
  });

  it('disables Cesium interface widgets', async () => {
    render(<FlightViewer3D flightId="flight-1" exportOnly />);

    await waitFor(() => {
      expect(viewerOptions[viewerOptions.length - 1]).toMatchObject({
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        fullscreenButton: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        vrButton: false,
        infoBox: false,
        selectionIndicator: false,
      });
    });
  });

  it('renders the full Cesium viewer after setting an export frame', async () => {
    window._exportMode = 'manual_render';

    render(<FlightViewer3D flightId="flight-1" exportOnly />);

    await waitFor(() => {
      expect(window._setExportFrame).toBeTypeOf('function');
    });

    const viewer = viewerInstances[viewerInstances.length - 1];
    const frameState = window._setExportFrame?.(1, 2);

    expect(frameState).toMatchObject({ progress: 100, tilesLoaded: true });
    expect(viewer.scene.requestRender).toHaveBeenCalled();
    expect(viewer.render).toHaveBeenCalled();
  });

  it('starts max quality export after switching mode', async () => {
    render(<FlightViewer3D flightId="flight-1" />);

    fireEvent.change(screen.getByLabelText('Export mode'), {
      target: { value: 'manual' },
    });

    expect(screen.getByText('Manual hint')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Generate video/ }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('flights/flight-1/export-video', {
        searchParams: { mode: 'manual' },
      });
    });
  });

  it('downloads generated videos without applying the API request timeout', async () => {
    mockFlight.video_export_status = 'completed';
    mockFlight.video_export_job_id = 'job-video';
    mockFlight.video_file_path = '/exports/job-video.mp4';
    const blob = vi.fn().mockResolvedValue(new Blob(['video']));
    apiGet.mockReturnValue({ blob });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:video'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });

    render(<FlightViewer3D flightId="flight-1" />);

    fireEvent.click(screen.getByRole('button', { name: /Download video/ }));

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('exports/job-video/download', {
        timeout: false,
      });
      expect(blob).toHaveBeenCalled();
    });
  });
});
