import type {
  Observation,
  Station,
  Summary,
  WeatherService,
} from '../src/data/types'

export const station: Station = {
  id: 7,
  name: 'Estação de teste',
  model: 'WS-2000',
  is_simulated: true,
  last_seen_at: '2026-11-20T15:01:00Z',
  communication: 'online',
  seconds_since_contact: 0,
  last_measured_at_utc: '2026-11-20T15:00:00Z',
  seconds_since_measurement: 60,
}
export const row: Observation = {
  id: 41,
  station_id: 7,
  measured_at_utc: '2026-11-20T15:00:00Z',
  received_at_utc: '2026-11-20T15:01:00Z',
  outdoor_temperature_c: 30.5,
  wind_speed_ms: 4.2,
  daily_rain_mm: 0,
  relative_pressure_hpa: 1013.2,
  outdoor_humidity_pct: null,
}
export const summary: Summary = {
  sample_count: 1,
  temperature_min_c: 30.5,
  temperature_avg_c: 30.5,
  temperature_max_c: 30.5,
  humidity_min_pct: null,
  humidity_avg_pct: null,
  humidity_max_pct: null,
  wind_avg_ms: 4.2,
  wind_max_ms: 4.2,
  latest: row,
}
export const service: WeatherService = {
  stations: async () => [station],
  station: async () => station,
  latest: async () => row,
  history: async () => ({ page: 1, page_size: 100, items: [row] }),
  summary: async () => summary,
}
