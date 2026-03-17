export const mockWeather = {
  current: {
    temperature: 18,
    wind_speed: 12,
    wind_direction: 45,
    wind_gust: 18,
    cloud_cover: 25,
    timestamp: new Date().toISOString(),
  },
  hourly: Array.from({ length: 48 }, (_, i) => ({
    timestamp: new Date(Date.now() + i * 3600000).toISOString(),
    temperature: 15 + Math.sin(i / 4) * 5,
    wind_speed: 10 + Math.random() * 10,
    wind_direction: 45 + Math.random() * 90,
    wind_gust: 15 + Math.random() * 15,
    cloud_cover: Math.random() * 100,
  })),
  daily: Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
    temp_min: 10 + Math.random() * 5,
    temp_max: 20 + Math.random() * 10,
    wind_speed_max: 15 + Math.random() * 15,
    precipitation_probability: Math.random() * 100,
  })),
}
