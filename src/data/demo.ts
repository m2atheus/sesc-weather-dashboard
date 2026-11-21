import type {
  Observation,
  Period,
  Station,
  Summary,
  WeatherService,
} from './types'
import { dayMs } from '../utils/format'

// Deterministic illustrative samples every 15 minutes, shared by all demo views.
const step = 900_000
const openedAt = Math.floor(Date.now() / 60_000) * 60_000
const first = Math.floor((openedAt - 31 * dayMs) / step) * step
function sample(t: number): Observation {
  const phase = t / step
  const sun = Math.max(0, Math.cos(((t % dayMs) / dayMs - 0.65) * Math.PI * 2))
  return {
    id: Math.floor(t / 60_000),
    station_id: 1,
    measured_at_utc: new Date(t).toISOString(),
    received_at_utc: new Date(t + 1700).toISOString(),
    outdoor_temperature_c: 24.2 + sun * 6 + Math.sin(phase * 0.4) * 0.8,
    indoor_temperature_c: 25.3 + sun,
    outdoor_humidity_pct: Math.round(74 - sun * 14 + Math.sin(phase)),
    indoor_humidity_pct: 61,
    wind_speed_ms: 2.8 + Math.sin(phase),
    wind_gust_ms: 5.4 + Math.sin(phase),
    wind_direction_deg: Math.round(120 + Math.sin(phase / 5) * 18),
    daily_rain_mm: 0,
    hourly_rain_mm: 0,
    weekly_rain_mm: 4.2,
    monthly_rain_mm: 18.8,
    yearly_rain_mm: 412,
    relative_pressure_hpa: 1012.6 + Math.sin(phase / 10),
    absolute_pressure_hpa: 963.4 + Math.sin(phase / 10),
    uv_index: Math.round(sun * 7),
    solar_radiation_wm2: Math.round(sun * 720),
  }
}
const nowSample = () => Math.floor(Date.now() / 60_000) * 60_000
function getStation(): Station {
  const time = sample(nowSample()).measured_at_utc
  return {
    id: 1,
    name: 'Estação demonstrativa',
    model: 'WS-2000',
    is_simulated: true,
    communication: 'online',
    last_seen_at: time,
    seconds_since_contact: 0,
    last_measured_at_utc: time,
    seconds_since_measurement: (Date.now() - nowSample()) / 1000,
  }
}
function times(period: Period) {
  const from = Math.max(first, Date.parse(period.start))
  const start = Math.ceil(from / step) * step
  const limit = Math.min(nowSample(), Date.parse(period.end))
  const end = Math.floor(Math.min(limit, openedAt - 1) / step) * step
  const history = Array.from(
    { length: Math.max(0, 1 + (end - start) / step) },
    (_, i) => end - i * step,
  )
  const live: number[] = []
  for (
    let t = Math.floor(limit / 60_000) * 60_000;
    t >= Math.max(from, openedAt);
    t -= 60_000
  )
    live.push(t)
  return live.concat(history)
}
export const demo: WeatherService = {
  async stations(page) {
    return page === 1 ? [getStation()] : []
  },
  async station() {
    return getStation()
  },
  async latest() {
    return sample(nowSample())
  },
  async history(_id, period, page) {
    return {
      page,
      page_size: 100,
      items: times(period)
        .slice((page - 1) * 100, page * 100)
        .map(sample),
    }
  },
  async summary(_id, period): Promise<Summary> {
    const rows = times(period).map(sample)
    function stats(
      key: 'outdoor_temperature_c' | 'outdoor_humidity_pct' | 'wind_speed_ms',
    ) {
      const values = rows.map((row) => row[key]!)
      return values.length
        ? [
            Math.min(...values),
            values.reduce((a, b) => a + b, 0) / values.length,
            Math.max(...values),
          ]
        : [null, null, null]
    }
    const [temperature_min_c, temperature_avg_c, temperature_max_c] = stats(
      'outdoor_temperature_c',
    )
    const [humidity_min_pct, humidity_avg_pct, humidity_max_pct] = stats(
      'outdoor_humidity_pct',
    )
    const [, wind_avg_ms, wind_max_ms] = stats('wind_speed_ms')
    return {
      sample_count: rows.length,
      temperature_min_c,
      temperature_avg_c,
      temperature_max_c,
      humidity_min_pct,
      humidity_avg_pct,
      humidity_max_pct,
      wind_avg_ms,
      wind_max_ms,
      latest: rows[0] ?? null,
    }
  },
}
