export const sensors = [
  'outdoor_temperature_c',
  'indoor_temperature_c',
  'outdoor_humidity_pct',
  'indoor_humidity_pct',
  'wind_speed_ms',
  'wind_gust_ms',
  'wind_direction_deg',
  'wind_gust_direction_deg',
  'daily_rain_mm',
  'hourly_rain_mm',
  'weekly_rain_mm',
  'monthly_rain_mm',
  'yearly_rain_mm',
  'absolute_pressure_hpa',
  'relative_pressure_hpa',
  'uv_index',
  'solar_radiation_wm2',
] as const
export type Sensor = (typeof sensors)[number]
export interface Observation extends Partial<Record<Sensor, number | null>> {
  id: number
  station_id: number
  measured_at_utc: string
  received_at_utc: string
}
export interface Station {
  id: number
  name: string
  model: string
  is_simulated: boolean
  last_seen_at: string
  communication: 'online' | 'delayed' | 'offline'
  seconds_since_contact: number
  last_measured_at_utc: string | null
  seconds_since_measurement: number | null
}
export const statistics = [
  'temperature_min_c',
  'temperature_avg_c',
  'temperature_max_c',
  'humidity_min_pct',
  'humidity_avg_pct',
  'humidity_max_pct',
  'wind_avg_ms',
  'wind_max_ms',
] as const
export interface Summary
  extends Record<(typeof statistics)[number], number | null> {
  sample_count: number
  latest: Observation | null
}
export interface Period {
  start: string
  end: string
}
export interface HistoryPage {
  page: number
  page_size: number
  items: Observation[]
}
export interface WeatherService {
  stations(page: number, signal: AbortSignal): Promise<Station[]>
  station(id: number, signal: AbortSignal): Promise<Station>
  latest(id: number, signal: AbortSignal): Promise<Observation | null>
  history(
    id: number,
    period: Period,
    page: number,
    signal: AbortSignal,
  ): Promise<HistoryPage>
  summary(id: number, period: Period, signal: AbortSignal): Promise<Summary>
}
