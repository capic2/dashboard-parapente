import { describe, expect, it } from 'vitest';
import { parseTelemetryGpxFile } from './telemetryGpxPreview';

describe('telemetry GPX preview', () => {
  it('reads heart rate from Garmin track point extensions', async () => {
    const file = new File(
      [
        `<gpx xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
          <trk><trkseg>
            <trkpt lat="45" lon="5"><time>2026-09-22T10:00:00Z</time><ele>1000</ele><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>120</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
            <trkpt lat="45.001" lon="5.001"><time>2026-09-22T10:00:01Z</time><ele>1001</ele><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>126</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
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
  });
});
