import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiPost, invalidateQueries } = vi.hoisted(() => ({
  apiPost: vi.fn(),
  invalidateQueries: vi.fn(),
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
    Entity: class Entity {},
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
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('react-aria-components', () => ({
  Disclosure: ({ children }: { children: (state: { isExpanded: boolean }) => React.ReactNode }) => (
    <div>{children({ isExpanded: true })}</div>
  ),
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
    data: {
      gpx_file_path: 'sample.gpx',
      video_export_status: null,
      video_export_job_id: null,
      video_file_path: null,
      site: null,
    },
  }),
}));

vi.mock('../../hooks/flights/useVideoExportStatus', () => ({
  formatEta: () => null,
  useVideoExportStatus: () => ({ status: null }),
}));

vi.mock('../../lib/api', () => ({
  api: {
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
  beforeEach(() => {
    apiPost.mockResolvedValue(undefined);
    apiPost.mockClear();
    invalidateQueries.mockClear();
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
});
