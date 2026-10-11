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
            <trkpt lat="45.002" lon="5.002"><time>2026-09-22T10:00:02Z</time><ele>1002</ele><extensions><gpxtpx:TrackPointExtension><gpxtpx:speed>50</gpxtpx:speed><gpxtpx:enhancedSpeed>4</gpxtpx:enhancedSpeed></gpxtpx:TrackPointExtension></extensions></trkpt>
            <trkpt lat="45.003" lon="5.003"><time>2026-09-22T10:00:03Z</time><ele>1003</ele><extensions><gpxtpx:TrackPointExtension><gpxtpx:speed> </gpxtpx:speed><gpxtpx:enhancedSpeed>3</gpxtpx:enhancedSpeed></gpxtpx:TrackPointExtension></extensions></trkpt>
          </trkseg></trk>
        </gpx>`,
      ],
      'heart-rate.gpx',
      { type: 'application/gpx+xml' }
    );

    const telemetry = await parseTelemetryGpxFile(file);

    expect(telemetry.points.map((point) => point.heart_rate)).toEqual([
      120,
      126,
      undefined,
      undefined,
    ]);
    expect(telemetry.points.map((point) => point.power)).toEqual([
      200,
      220,
      undefined,
      undefined,
    ]);
    expect(telemetry.points.map((point) => point.speed_kmh)).toEqual([
      36, 43.2, 14.4, 10.8,
    ]);
  });
});
