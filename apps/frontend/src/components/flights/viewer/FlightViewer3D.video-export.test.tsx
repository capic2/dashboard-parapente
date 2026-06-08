import { render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  invalidateQueries,
  mockFlight,
  cartesianFromDegreesCalls,
  entityOptions,
  viewerInstances,
  viewerOptions,
} = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  cartesianFromDegreesCalls: [] as unknown[][],
  entityOptions: [] as unknown[],
  viewerInstances: [] as {
    render: ReturnType<typeof vi.fn>;
    destroy: () => void;
    isDestroyed: () => boolean;
    useDefaultRenderLoop: boolean;
    camera: {
      moveBackward: ReturnType<typeof vi.fn>;
    };
    scene?: {
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

    static fromDegrees(...args: unknown[]) {
      cartesianFromDegreesCalls.push(args);
      return new Cartesian3();
    }

    static fromRadians() {
      return new Cartesian3();
    }

    static distanceSquared() {
      return 1;
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

    static fromCssColorString() {
      return new Color();
    }

    withAlpha() {
      return this;
    }
  }

  class Viewer {
    scene:
      | {
          globe: {
            tilesLoaded: boolean;
            getHeight: () => number;
          };
          requestRender: ReturnType<typeof vi.fn>;
          render: ReturnType<typeof vi.fn>;
          screenSpaceCameraController: { enableCollisionDetection: boolean };
          postProcessStages: {
            ambientOcclusion: { enabled: boolean; uniforms: object };
          };
          light: { intensity: number };
        }
      | undefined = {
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
      moveForward: vi.fn(),
      flyToBoundingSphere: vi.fn(),
    };
    entities = {
      add: vi.fn((options: unknown) => {
        entityOptions.push(options);
        return options;
      }),
      contains: vi.fn(() => false),
      remove: vi.fn(),
    };
    shadows = false;
    terrainShadows = 0;
    useDefaultRenderLoop = true;
    render = vi.fn();
    destroyed = false;

    constructor(_container: Element, options: unknown) {
      viewerOptions.push(options);
      viewerInstances.push(this);
    }

    isDestroyed() {
      return this.destroyed;
    }

    destroy() {
      this.destroyed = true;
      this.scene = undefined;
      return undefined;
    }
  }

  return {
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
    CornerType: { ROUNDED: 0 },
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
    ImageMaterialProperty: class ImageMaterialProperty {
      constructor(public options: unknown) {}
    },
    Ion: { defaultAccessToken: '' },
    JulianDate: { fromDate: () => ({}), fromIso8601: () => ({}) },
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
    isDisabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    isDisabled?: boolean;
  }) => (
    <button type="button" disabled={isDisabled} {...props}>
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
      })[key] ?? key,
  }),
  withTranslation: () => (Component: unknown) => Component,
}));

vi.mock('../../../hooks/flights/useFlightGPX', () => ({
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

vi.mock('../../../hooks/flights/useFlight', () => ({
  useFlight: () => ({
    data: mockFlight,
  }),
}));

vi.mock('../../../lib/api', () => ({
  api: {},
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));

vi.mock('../../../hooks/useToast', () => ({
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
    invalidateQueries.mockClear();
    viewerInstances.length = 0;
    viewerOptions.length = 0;
    cartesianFromDegreesCalls.length = 0;
    entityOptions.length = 0;
    mockFlight.video_export_status = null;
    mockFlight.video_export_job_id = null;
    mockFlight.video_file_path = null;
    window._exportMode = undefined;
    window._setExportFrame = undefined;
    window._getExportMetadata = undefined;
    window._gpxData = undefined;
    window._cesiumViewer = undefined;
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
    window._getExportMetadata = undefined;
    window._gpxData = undefined;
    window._cesiumViewer = undefined;
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
    expect(
      screen.queryByRole('button', { name: /Generate video/u })
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
    expect(viewer.scene?.requestRender).toHaveBeenCalled();
    expect(viewer.render).toHaveBeenCalled();
  });

  it('keeps the export camera distance constant across frames', async () => {
    window._exportMode = 'manual_render';

    render(<FlightViewer3D flightId="flight-1" exportOnly />);

    await waitFor(() => {
      expect(window._setExportFrame).toBeTypeOf('function');
    });

    const viewer = viewerInstances[viewerInstances.length - 1];

    window._setExportFrame?.(0, 3);
    window._setExportFrame?.(1, 3);
    window._setExportFrame?.(2, 3);

    expect(viewer.camera.moveBackward).toHaveBeenNthCalledWith(1, 500);
    expect(viewer.camera.moveBackward).toHaveBeenNthCalledWith(2, 500);
    expect(viewer.camera.moveBackward).toHaveBeenNthCalledWith(3, 500);
  });

  it('passes GPX longitude, latitude and rendered elevation to Cesium', async () => {
    window._exportMode = 'manual_render';

    render(<FlightViewer3D flightId="flight-1" exportOnly />);

    await waitFor(() => {
      expect(window._setExportFrame).toBeTypeOf('function');
    });

    await waitFor(() => {
      expect(cartesianFromDegreesCalls[0]).toEqual([6, 45, 1000]);
      expect(cartesianFromDegreesCalls[1]).toEqual([6.1, 45.1, 1100]);
    });
  });

  it('draws the replay track as a wall without a thick line', async () => {
    window._exportMode = 'manual_render';

    render(<FlightViewer3D flightId="flight-1" exportOnly />);

    await waitFor(() => {
      expect(window._setExportFrame).toBeTypeOf('function');
    });

    window._setExportFrame?.(1, 2);

    expect(
      entityOptions.some((options) =>
        Boolean((options as { polyline?: unknown }).polyline)
      )
    ).toBe(false);
    expect(
      entityOptions.some((options) =>
        Boolean((options as { polylineVolume?: unknown }).polylineVolume)
      )
    ).toBe(false);
    expect(
      entityOptions.some((options) =>
        Boolean((options as { wall?: unknown }).wall)
      )
    ).toBe(true);
  });

  it('ignores stale wall callbacks after switching flights', async () => {
    window._exportMode = 'manual_render';

    const { rerender } = render(
      <FlightViewer3D key="flight-1" flightId="flight-1" exportOnly />
    );

    await waitFor(() => {
      expect(window._setExportFrame).toBeTypeOf('function');
    });

    window._setExportFrame?.(1, 2);
    const staleWall = entityOptions.find(
      (
        options
      ): options is {
        wall: {
          positions: { callback: () => unknown };
          minimumHeights: { callback: () => unknown };
        };
      } =>
        Boolean(
          (options as { wall?: { minimumHeights?: unknown } }).wall
            ?.minimumHeights
        )
    );

    expect(staleWall).toBeDefined();

    rerender(<FlightViewer3D key="flight-2" flightId="flight-2" exportOnly />);

    expect(staleWall?.wall.positions.callback()).toEqual([]);
    expect(staleWall?.wall.minimumHeights.callback()).toEqual([]);
  });

  it('clears export globals when the Cesium viewer unmounts', async () => {
    window._exportMode = 'manual_render';

    const { unmount } = render(
      <FlightViewer3D flightId="flight-1" exportOnly />
    );

    await waitFor(() => {
      expect(window._setExportFrame).toBeTypeOf('function');
    });

    expect(window._cesiumViewer).toBe(
      viewerInstances[viewerInstances.length - 1]
    );
    expect(window._gpxData).toBeDefined();

    unmount();

    expect(
      viewerInstances[viewerInstances.length - 1]?.useDefaultRenderLoop
    ).toBe(false);
    expect(window._setExportFrame).toBeUndefined();
    expect(window._getExportMetadata).toBeUndefined();
    expect(window._cesiumViewer).toBeUndefined();
    expect(window._gpxData).toBeUndefined();
    expect(viewerInstances[viewerInstances.length - 1]?.isDestroyed()).toBe(
      true
    );
  });
});
