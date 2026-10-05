import { describe, expect, it } from 'vitest';
import { parseTelemetryGpxFile } from './telemetryGpxPreview';

describe('telemetry GPX preview', () => {
  it('reads Garmin telemetry extensions used by the layout widgets', async () => {
    const file = new File(
      [
        `<gpx xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
          <trk><trkseg>
            <trkpt lat="45" lon="5"><time>2026-09-22T10:00:00Z</time><ele>1000</ele><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>120</gpxtpx:hr><gpxtpx:power>200</gpxtpx:power><gpxtpx:speed>10</gpxtpx:speed></gpxtpx:TrackPointExtension></extensions></trkpt>
            <trkpt lat="45.001" lon="5.001"><time>2026-09-22T10:00:01Z</time><ele>1001</ele><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>126</gpxtpx:hr><gpxtpx:power>220</gpxtpx:power><gpxtpx:speed>12</gpxtpx:speed></gpxtpx:TrackPointExtension></extensions></trkpt>
          </trkseg></trk>
        </gpx>`,
      ],
      'heart-rate.gpx',
      { type: 'application/gpx+xml' }
    );

    const telemetry = await parseTelemetryGpxFile(file);

    expect(telemetry.points.map((point) => point.heart_rate)).toEqual([
      120, 126,
    ]);
    expect(telemetry.points.map((point) => point.power)).toEqual([200, 220]);
    expect(telemetry.points.map((point) => point.speed_kmh)).toEqual([
      36, 43.2,
    ]);
  });
});
