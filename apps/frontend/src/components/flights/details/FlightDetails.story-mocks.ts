import { http, HttpResponse } from 'msw';
import type { Flight } from '../../../types';
import { serializeTelemetryLayoutXml } from './flightTelemetryLayout';

export const fullFlight: Flight = {
  id: 'flight-001',
  name: 'Arguel 15-03 14h00',
  title: 'Vol thermique Arguel',
  flight_date: '2026-03-15',
  tags: [],
  departure_time: '2026-03-15T14:00:00',
  duration_minutes: 95,
  distance_km: 18.5,
  max_altitude_m: 1850,
  max_speed_kmh: 52.3,
  elevation_gain_m: 1200,
  site_id: 'site-arguel',
  site_name: 'Arguel',
  notes: 'Superbe vol thermique, base cumulus 1800m',
  gpx_file_path: '/data/flights/arguel-001.gpx',
  video_file_path: '/data/flights/arguel-001.mp4',
  video_file_exists: true,
  gopro_camera_file_exists: true,
  gopro_overlay_file_path: '/data/flights/final.mp4',
  gopro_overlay_gpx_offset: 0,
};

const mockGPXData = {
  coordinates: Array.from({ length: 100 }, (_, i) => ({
    lat: 47.2 + i * 0.001,
    lon: 6.0 + i * 0.001,
    elevation: 800 + Math.sin(i / 10) * 400,
    timestamp: 1773842400000 + i * 60000,
  })),
  max_altitude_m: 1850,
  min_altitude_m: 700,
  altitude_range_m: 1150,
  takeoff_altitude_m: 800,
  landing_altitude_m: 760,
  elevation_gain_m: 1200,
  elevation_loss_m: 1240,
  total_distance_km: 18.5,
  max_distance_from_takeoff_km: 8.4,
  flight_duration_seconds: 5700,
  average_speed_kmh: 11.7,
  max_speed_kmh: 52.3,
  max_climb_rate_ms: 4.6,
  max_sink_rate_ms: 3.2,
};

export const defaultHandlers = [
  http.get('*/api/flights/:id/video/thumbnail', () =>
    HttpResponse.text(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#312e81"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><path d="M0 290 170 145 280 245 420 100 640 290V360H0Z" fill="#e0f2fe"/><circle cx="505" cy="78" r="32" fill="#fef3c7"/></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    )
  ),
  http.get('*/api/flights/:id/pano/thumbnail', () =>
    HttpResponse.text(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="p" x2="1"><stop stop-color="#4c1d95"/><stop offset="1" stop-color="#c4b5fd"/></linearGradient></defs><rect width="640" height="360" fill="url(#p)"/><circle cx="320" cy="180" r="110" fill="none" stroke="white" stroke-width="8"/><path d="M50 270 210 130 320 230 460 105 610 270" fill="none" stroke="white" stroke-width="12"/></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    )
  ),
  http.get('*/api/flights/:id/temporary-media/face/thumbnail', () =>
    HttpResponse.text(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#0f766e"/><circle cx="320" cy="130" r="70" fill="#fcd34d"/><path d="M160 360c12-98 58-145 160-145s148 47 160 145" fill="#f8fafc"/></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    )
  ),
  http.get('*/api/flights/:id/temporary-media/pilote/thumbnail', () =>
    HttpResponse.text(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#1e3a8a"/><path d="M0 290 170 130 280 220 420 90 640 270V360H0Z" fill="#bae6fd"/><circle cx="505" cy="70" r="28" fill="#fef3c7"/></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    )
  ),
  http.get('*/api/gopro-overlays/jobs/:jobId/thumbnail', ({ params }) =>
    HttpResponse.text(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#083344"/><path d="M0 300 190 120 320 250 470 90 640 280V360H0Z" fill="#67e8f9"/><rect x="24" y="24" width="260" height="72" rx="12" fill="#0f172a"/><text x="44" y="68" fill="white" font-size="22">${String(params.jobId)}</text></svg>`,
      { headers: { 'Content-Type': 'image/svg+xml' } }
    )
  ),
  http.get('*/api/flights/:id/gopro-overlay/thumbnail', () =>
    HttpResponse.text(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#083344"/><path d="M0 300 190 120 320 250 470 90 640 280V360H0Z" fill="#67e8f9"/><rect x="24" y="24" width="180" height="72" rx="12" fill="#0f172a"/><text x="44" y="68" fill="white" font-size="24">GoPro overlay</text></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    )
  ),
  http.get(
    '*/api/flights/:id/gopro-camera/preview',
    () =>
      new HttpResponse(new Uint8Array(), {
        headers: { 'Content-Type': 'video/mp4' },
      })
  ),
  http.get('*/api/flights/:id/gopro-camera/thumbnail', () =>
    HttpResponse.text(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#111827"/><circle cx="320" cy="150" r="70" fill="#f59e0b"/><path d="M120 330 280 180 390 250 520 120 640 300V360H120Z" fill="#38bdf8"/></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    )
  ),
  http.get('*/api/flights/:id/gopro-overlay/preview', () =>
    HttpResponse.json({
      video: {
        duration_seconds: 600,
        start_time: '2026-03-18T10:00:00Z',
        preview_target_end_seconds: 600,
        preview_segments: [
          {
            preview_start_seconds: 0,
            source_start_seconds: 0,
            duration_seconds: 180,
          },
          {
            preview_start_seconds: 180,
            source_start_seconds: 420,
            duration_seconds: 180,
          },
        ],
        preview_status: 'ready',
        preview_available_duration_seconds: 180,
        preview_requested_duration_seconds: 180,
        preview_max_duration_seconds: 600,
      },
      gpx: {
        start_time: '2026-03-18T10:00:08Z',
        end_time: '2026-03-18T11:39:08Z',
        duration_seconds: 5940,
        coordinates: mockGPXData.coordinates,
      },
      alignment: {
        automatic_offset_seconds: 8,
        manual_offset_seconds: 0,
        effective_offset_seconds: 8,
      },
      overlay: { status: 'missing', job: null },
    })
  ),
  http.get('*/api/flights/:id/telemetry', () =>
    HttpResponse.json({
      points: mockGPXData.coordinates.map((point) => ({
        ...point,
        segment: 0,
      })),
      source: 'gpx',
      has_osv: false,
      enrichment_status: 'ready',
      enrichment_error: null,
      start_time: '2026-03-18T10:00:00Z',
      end_time: '2026-03-18T11:39:00Z',
      duration_seconds: 5940,
    })
  ),
  http.get('*/api/flights/:id/telemetry-layout', () =>
    HttpResponse.json({
      id: null,
      scope: 'flight',
      flight_id: 'flight-001',
      xml_content: serializeTelemetryLayoutXml([]),
      format_version: 1,
      is_override: false,
    })
  ),
  http.get('*/api/flights/:id/gpx-data', () =>
    HttpResponse.json({ data: mockGPXData })
  ),
  http.get('*/api/flights/:id/gpx', () =>
    HttpResponse.text('<gpx></gpx>', {
      headers: { 'Content-Type': 'application/gpx+xml' },
    })
  ),
  http.get('*/api/flights/:id/video', () =>
    HttpResponse.arrayBuffer(new ArrayBuffer(8), {
      headers: { 'Content-Type': 'video/mp4' },
    })
  ),
  http.get('*/api/flights/:id/gopro-overlay', () =>
    HttpResponse.arrayBuffer(new ArrayBuffer(8), {
      headers: { 'Content-Type': 'video/mp4' },
    })
  ),
  http.get('*/api/youtube/status', () =>
    HttpResponse.json({ configured: true, connected: false })
  ),
  http.get('*/api/flights/:id/youtube-upload', () => HttpResponse.json(null)),
  http.get('*/api/flights/:id/youtube-videos', () => HttpResponse.json([])),
  http.get('*/api/flights/:id/highlight-videos', () => HttpResponse.json([])),
  http.get('*/api/flights/:id/overlay-layer', () =>
    HttpResponse.json({ status: 'completed', job: null })
  ),
  http.get('*/api/flights/:id', () => HttpResponse.json(fullFlight)),
  http.patch('*/api/flights/:id', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ data: { ...fullFlight, ...(body as object) } });
  }),
  http.post('*/api/flights/:id/upload-gpx', () =>
    HttpResponse.json({
      success: true,
      flight_id: 'flight-001',
      gpx_file_path: '/data/flights/new.gpx',
      message: 'OK',
    })
  ),
  http.post('*/api/flights/:id/gopro-overlay', () =>
    HttpResponse.json({
      job_id: 'job-gopro-overlay',
      status: 'queued',
      progress: 0,
      message: 'queued',
      layout_id: 'parapente-1080',
      layout_label: 'Parapente 1920x1080',
      output_filename: 'Vol_à_Arguel-1080p.mp4',
      created_at: '2026-03-15T14:00:00Z',
      updated_at: '2026-03-15T14:00:00Z',
      job_token: 'token-gopro-overlay',
    })
  ),
];
