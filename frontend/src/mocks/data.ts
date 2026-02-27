// Mock data pour MSW - basé sur les données réelles de la BD

export const sites = [
  {
    id: 'site-arguel',
    code: 'ARGUEL',
    name: 'Arguel',
    elevation_m: 427,
    latitude: 47.2518,
    longitude: 6.1234,
    region: 'Franche-Comté',
    country: 'FR',
    created_at: '2025-09-01T10:00:00Z',
    updated_at: '2025-09-01T10:00:00Z'
  },
  {
    id: 'site-mont-poupet',
    code: 'MONT_POUPET',
    name: 'Mont Poupet',
    elevation_m: 842,
    latitude: 47.3267,
    longitude: 6.189,
    region: 'Franche-Comté',
    country: 'FR',
    created_at: '2025-09-01T10:00:00Z',
    updated_at: '2025-09-01T10:00:00Z'
  },
  {
    id: 'site-la-cote',
    code: 'LA_COTE',
    name: 'La Côte',
    elevation_m: 800,
    latitude: 47.1456,
    longitude: 6.2456,
    region: 'Franche-Comté',
    country: 'FR',
    created_at: '2025-09-01T10:00:00Z',
    updated_at: '2025-09-01T10:00:00Z'
  }
];

export const flights = [
  {
    id: '72672aab-7213-43fb-8ad8-ed9fbc0f3246',
    site_id: 'site-la-cote',
    site_name: 'La Côte',
    title: 'La Côte 08-11 14h53',
    name: 'La Côte 08-11 14h53',
    flight_date: '2025-11-08',
    departure_time: '2025-11-08T14:53:00Z',
    duration_minutes: 11,
    max_altitude_m: 872,
    distance_km: 4.6,
    elevation_gain_m: 72,
    gpx_file_path: 'db/gpx/strava_16394022550.gpx',
    strava_id: '16394022550',
    notes: null,
    description: null,
    external_url: 'https://www.strava.com/activities/16394022550',
    created_at: '2025-11-08T15:10:00Z',
    updated_at: '2025-11-08T15:10:00Z'
  },
  {
    id: '54b9af02-1d62-4195-8aa0-8040e880cb74',
    site_id: 'site-la-cote',
    site_name: 'La Côte',
    title: 'La Côte 08-11 16h01',
    name: 'La Côte 08-11 16h01',
    flight_date: '2025-11-08',
    departure_time: '2025-11-08T16:01:00Z',
    duration_minutes: 6,
    max_altitude_m: 800,
    distance_km: 2.2,
    elevation_gain_m: 0,
    gpx_file_path: 'db/gpx/strava_16394749726.gpx',
    strava_id: '16394749726',
    notes: null,
    description: null,
    external_url: 'https://www.strava.com/activities/16394749726',
    created_at: '2025-11-08T16:15:00Z',
    updated_at: '2025-11-08T16:15:00Z'
  },
  {
    id: '81c2567a-dc68-4ddc-8ce4-4745eb380a0c',
    site_id: 'site-mont-poupet',
    site_name: 'Mont Poupet',
    title: 'Mont Poupet 12-10 16h17',
    name: 'Mont Poupet 12-10 16h17',
    flight_date: '2025-10-12',
    departure_time: '2025-10-12T16:17:00Z',
    duration_minutes: 4,
    max_altitude_m: 842,
    distance_km: 1.5,
    elevation_gain_m: 0,
    gpx_file_path: 'db/gpx/strava_16118040828.gpx',
    strava_id: '16118040828',
    notes: null,
    description: null,
    external_url: 'https://www.strava.com/activities/16118040828',
    created_at: '2025-10-12T16:30:00Z',
    updated_at: '2025-10-12T16:30:00Z'
  },
  {
    id: '7d386bbe-4d16-42af-bcbd-a25c54a0ce43',
    site_id: 'site-arguel',
    site_name: 'Arguel',
    title: 'Arguel 28-09 15h42',
    name: 'Arguel 28-09 15h42',
    flight_date: '2025-09-28',
    departure_time: '2025-09-28T15:42:00Z',
    duration_minutes: 5,
    max_altitude_m: 433,
    distance_km: 2.4,
    elevation_gain_m: 6,
    gpx_file_path: 'db/gpx/strava_15963566849.gpx',
    strava_id: '15963566849',
    notes: null,
    description: null,
    external_url: 'https://www.strava.com/activities/15963566849',
    created_at: '2025-09-28T16:00:00Z',
    updated_at: '2025-09-28T16:00:00Z'
  },
  {
    id: '027949c0-7ba6-45a1-8291-147b6b962031',
    site_id: 'site-arguel',
    site_name: 'Arguel',
    title: 'Arguel 28-09 17h22',
    name: 'Arguel 28-09 17h22',
    flight_date: '2025-09-28',
    departure_time: '2025-09-28T17:22:00Z',
    duration_minutes: 31,
    max_altitude_m: 676,
    distance_km: 13.1,
    elevation_gain_m: 249,
    gpx_file_path: 'db/gpx/strava_15965366307.gpx',
    strava_id: '15965366307',
    notes: null,
    description: null,
    external_url: 'https://www.strava.com/activities/15965366307',
    created_at: '2025-09-28T18:00:00Z',
    updated_at: '2025-09-28T18:00:00Z'
  },
  {
    id: '90d9748a-27d2-4dd5-96bc-6c7347bfcf5f',
    site_id: 'site-arguel',
    site_name: 'Arguel',
    title: 'Arguel 27-09 17h08',
    name: 'Arguel 27-09 17h08',
    flight_date: '2025-09-27',
    departure_time: '2025-09-27T17:08:00Z',
    duration_minutes: 5,
    max_altitude_m: 435,
    distance_km: 2.0,
    elevation_gain_m: 8,
    gpx_file_path: 'db/gpx/strava_15954552836.gpx',
    strava_id: '15954552836',
    notes: null,
    description: null,
    external_url: 'https://www.strava.com/activities/15954552836',
    created_at: '2025-09-27T17:30:00Z',
    updated_at: '2025-09-27T17:30:00Z'
  }
];

// Mock GPX data pour chaque vol
export const gpxData: Record<string, any> = {
  '72672aab-7213-43fb-8ad8-ed9fbc0f3246': {
    coordinates: [
      { lon: 6.2456, lat: 47.1456, elevation: 800, time: '2025-11-08T14:53:00Z' },
      { lon: 6.2465, lat: 47.1465, elevation: 820, time: '2025-11-08T14:54:00Z' },
      { lon: 6.2475, lat: 47.1475, elevation: 850, time: '2025-11-08T14:56:00Z' },
      { lon: 6.2485, lat: 47.1485, elevation: 872, time: '2025-11-08T14:58:00Z' },
      { lon: 6.2480, lat: 47.1480, elevation: 840, time: '2025-11-08T15:00:00Z' },
      { lon: 6.2470, lat: 47.1470, elevation: 810, time: '2025-11-08T15:02:00Z' },
      { lon: 6.2460, lat: 47.1460, elevation: 805, time: '2025-11-08T15:04:00Z' }
    ],
    stats: {
      total_points: 7,
      duration_seconds: 660,
      max_altitude_m: 872,
      min_altitude_m: 800,
      elevation_gain_m: 72,
      distance_km: 4.6
    }
  },
  '54b9af02-1d62-4195-8aa0-8040e880cb74': {
    coordinates: [
      { lon: 6.2456, lat: 47.1456, elevation: 800, time: '2025-11-08T16:01:00Z' },
      { lon: 6.2465, lat: 47.1465, elevation: 798, time: '2025-11-08T16:03:00Z' },
      { lon: 6.2470, lat: 47.1470, elevation: 795, time: '2025-11-08T16:05:00Z' },
      { lon: 6.2460, lat: 47.1460, elevation: 800, time: '2025-11-08T16:07:00Z' }
    ],
    stats: {
      total_points: 4,
      duration_seconds: 360,
      max_altitude_m: 800,
      min_altitude_m: 795,
      elevation_gain_m: 0,
      distance_km: 2.2
    }
  },
  '81c2567a-dc68-4ddc-8ce4-4745eb380a0c': {
    coordinates: [
      { lon: 6.189, lat: 47.3267, elevation: 842, time: '2025-10-12T16:17:00Z' },
      { lon: 6.190, lat: 47.3275, elevation: 838, time: '2025-10-12T16:18:30Z' },
      { lon: 6.191, lat: 47.3280, elevation: 835, time: '2025-10-12T16:20:00Z' },
      { lon: 6.189, lat: 47.3268, elevation: 840, time: '2025-10-12T16:21:00Z' }
    ],
    stats: {
      total_points: 4,
      duration_seconds: 240,
      max_altitude_m: 842,
      min_altitude_m: 835,
      elevation_gain_m: 0,
      distance_km: 1.5
    }
  },
  '7d386bbe-4d16-42af-bcbd-a25c54a0ce43': {
    coordinates: [
      { lon: 6.1234, lat: 47.2518, elevation: 427, time: '2025-09-28T15:42:00Z' },
      { lon: 6.1240, lat: 47.2525, elevation: 430, time: '2025-09-28T15:43:30Z' },
      { lon: 6.1245, lat: 47.2530, elevation: 433, time: '2025-09-28T15:45:00Z' },
      { lon: 6.1235, lat: 47.2520, elevation: 428, time: '2025-09-28T15:47:00Z' }
    ],
    stats: {
      total_points: 4,
      duration_seconds: 300,
      max_altitude_m: 433,
      min_altitude_m: 427,
      elevation_gain_m: 6,
      distance_km: 2.4
    }
  },
  '027949c0-7ba6-45a1-8291-147b6b962031': {
    coordinates: [
      { lon: 6.1234, lat: 47.2518, elevation: 427, time: '2025-09-28T17:22:00Z' },
      { lon: 6.1250, lat: 47.2535, elevation: 480, time: '2025-09-28T17:25:00Z' },
      { lon: 6.1280, lat: 47.2560, elevation: 550, time: '2025-09-28T17:30:00Z' },
      { lon: 6.1320, lat: 47.2590, elevation: 620, time: '2025-09-28T17:35:00Z' },
      { lon: 6.1350, lat: 47.2610, elevation: 676, time: '2025-09-28T17:40:00Z' },
      { lon: 6.1330, lat: 47.2595, elevation: 640, time: '2025-09-28T17:43:00Z' },
      { lon: 6.1300, lat: 47.2570, elevation: 580, time: '2025-09-28T17:46:00Z' },
      { lon: 6.1260, lat: 47.2540, elevation: 500, time: '2025-09-28T17:49:00Z' },
      { lon: 6.1240, lat: 47.2525, elevation: 450, time: '2025-09-28T17:52:00Z' }
    ],
    stats: {
      total_points: 9,
      duration_seconds: 1860,
      max_altitude_m: 676,
      min_altitude_m: 427,
      elevation_gain_m: 249,
      distance_km: 13.1
    }
  },
  '90d9748a-27d2-4dd5-96bc-6c7347bfcf5f': {
    coordinates: [
      { lon: 6.1234, lat: 47.2518, elevation: 427, time: '2025-09-27T17:08:00Z' },
      { lon: 6.1240, lat: 47.2525, elevation: 432, time: '2025-09-27T17:09:30Z' },
      { lon: 6.1245, lat: 47.2530, elevation: 435, time: '2025-09-27T17:11:00Z' },
      { lon: 6.1235, lat: 47.2520, elevation: 430, time: '2025-09-27T17:13:00Z' }
    ],
    stats: {
      total_points: 4,
      duration_seconds: 300,
      max_altitude_m: 435,
      min_altitude_m: 427,
      elevation_gain_m: 8,
      distance_km: 2.0
    }
  }
};

// Mock weather data
export const weatherData: Record<string, any> = {
  'site-arguel': {
    site_id: 'site-arguel',
    site_name: 'Arguel',
    day_index: 0,
    para_index: 75,
    verdict: 'BON',
    emoji: '✅',
    explanation: 'Bonnes conditions de vol',
    metrics: {
      wind_avg: 12,
      wind_max: 18,
      temp_avg: 15,
      precipitation: 0
    },
    consensus: [
      { hour: 10, wind_avg: 10, wind_max: 15, temp: 14, precipitation: 0 },
      { hour: 12, wind_avg: 12, wind_max: 18, temp: 16, precipitation: 0 },
      { hour: 14, wind_avg: 14, wind_max: 20, temp: 17, precipitation: 0 },
      { hour: 16, wind_avg: 12, wind_max: 18, temp: 15, precipitation: 0 }
    ],
    slots: [
      { start: '10:00', end: '11:00', status: 'good', wind_avg: 10 },
      { start: '12:00', end: '13:00', status: 'good', wind_avg: 12 },
      { start: '14:00', end: '15:00', status: 'medium', wind_avg: 14 },
      { start: '16:00', end: '17:00', status: 'good', wind_avg: 12 }
    ],
    slots_summary: '4 créneaux volables',
    total_sources: 3
  },
  'site-mont-poupet': {
    site_id: 'site-mont-poupet',
    site_name: 'Mont Poupet',
    day_index: 0,
    para_index: 82,
    verdict: 'BON',
    emoji: '✅',
    explanation: 'Excellentes conditions de vol',
    metrics: {
      wind_avg: 10,
      wind_max: 15,
      temp_avg: 16,
      precipitation: 0
    },
    consensus: [
      { hour: 10, wind_avg: 8, wind_max: 12, temp: 15, precipitation: 0 },
      { hour: 12, wind_avg: 10, wind_max: 15, temp: 17, precipitation: 0 },
      { hour: 14, wind_avg: 11, wind_max: 16, temp: 18, precipitation: 0 },
      { hour: 16, wind_avg: 9, wind_max: 14, temp: 16, precipitation: 0 }
    ],
    slots: [
      { start: '10:00', end: '11:00', status: 'good', wind_avg: 8 },
      { start: '12:00', end: '13:00', status: 'good', wind_avg: 10 },
      { start: '14:00', end: '15:00', status: 'good', wind_avg: 11 },
      { start: '16:00', end: '17:00', status: 'good', wind_avg: 9 }
    ],
    slots_summary: '4 créneaux volables',
    total_sources: 3
  },
  'site-la-cote': {
    site_id: 'site-la-cote',
    site_name: 'La Côte',
    day_index: 0,
    para_index: 68,
    verdict: 'MOYEN',
    emoji: '⚠️',
    explanation: 'Conditions moyennes, vent un peu fort',
    metrics: {
      wind_avg: 15,
      wind_max: 22,
      temp_avg: 14,
      precipitation: 0
    },
    consensus: [
      { hour: 10, wind_avg: 12, wind_max: 18, temp: 13, precipitation: 0 },
      { hour: 12, wind_avg: 15, wind_max: 22, temp: 15, precipitation: 0 },
      { hour: 14, wind_avg: 18, wind_max: 25, temp: 16, precipitation: 0 },
      { hour: 16, wind_avg: 14, wind_max: 20, temp: 14, precipitation: 0 }
    ],
    slots: [
      { start: '10:00', end: '11:00', status: 'good', wind_avg: 12 },
      { start: '12:00', end: '13:00', status: 'medium', wind_avg: 15 },
      { start: '14:00', end: '15:00', status: 'bad', wind_avg: 18 },
      { start: '16:00', end: '17:00', status: 'medium', wind_avg: 14 }
    ],
    slots_summary: '2 créneaux volables',
    total_sources: 3
  }
};

// Mock flight stats
export const flightStats = {
  total_flights: 6,
  total_hours: 1.0,
  total_duration_minutes: 62,
  total_distance: 25.8,
  total_distance_km: 25.8,
  total_elevation_gain_m: 335,
  avg_duration: 10.3,
  avg_duration_minutes: 10.3,
  avg_distance_km: 4.3,
  max_altitude_m: 872,
  favorite_spot: 'Arguel',
  favorite_site: null,
  last_flight_date: '2025-11-08'
};
