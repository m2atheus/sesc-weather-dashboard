import { dateTime, metric } from '../utils/format'
import type { Observation, Period, Summary, WeatherService } from './types'
import { variables, type Variable } from './variables'

export async function readPeriodRows(
  service: WeatherService, station: number, period: Period, expected: number, signal: AbortSignal,
) {
  const rows = new Map<number, Observation>()
  if (expected === 0) return []
  for (let page = 1; ; page++) {
    signal.throwIfAborted()
    const result = await service.history(station, period, page, signal)
    for (const row of result.items) {
      if (rows.has(row.id) || row.station_id !== station || rows.size >= expected)
        throw new Error('Histórico inconsistente com o resumo do período.')
      rows.set(row.id, row)
    }
    if (result.items.length < result.page_size) break
  }
  if (rows.size !== expected) throw new Error('Histórico incompleto para este período.')
  return [...rows.values()]
}

function readings(rows: Observation[], key: keyof Observation) {
  let count = 0, sum = 0
  let min = Infinity, max = -Infinity
  let peakTime: string | undefined
  for (const row of rows) {
    const value = row[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    count++
    sum += value
    min = Math.min(min, value)
    if (value > max || (value === max && Date.parse(row.measured_at_utc) < Date.parse(peakTime!))) {
      max = value
      peakTime = row.measured_at_utc
    }
  }
  return { count, min: count ? min : null, avg: count ? sum / count : null, max: count ? max : null, peakTime }
}

type Indicator = { title: string; value: string; detail?: string }
export function historyIndicators(
  variable: Variable, summary?: Summary, rows?: Observation[], loading = false,
): Indicator[] {
  const { title, key, unit } = variables[variable]
  const stats = rows && readings(rows, key)
  const missing = loading ? 'Carregando…' : 'Indisponível'
  function card(title: string, value: number | null | undefined, suffix = unit): Indicator {
    return { title, value: value === undefined ? missing : value === null ? 'Sem dados' : metric(value, suffix) }
  }
  function range(label: string, min?: number | null, avg?: number | null, max?: number | null) {
    return [card(label + ' mínima', min), card(label + ' média', avg), card(label + ' máxima', max)]
  }
  const indicators = [card('Medições no período', stats?.count, '')]
  switch (variable) {
    case 'temperature':
      return indicators.concat(range(title, summary?.temperature_min_c, summary?.temperature_avg_c, summary?.temperature_max_c))
    case 'humidity':
      return indicators.concat(range('Umidade', summary?.humidity_min_pct, summary?.humidity_avg_pct, summary?.humidity_max_pct))
    case 'wind':
      return indicators.concat(card('Velocidade média', summary?.wind_avg_ms), card('Velocidade máxima', summary?.wind_max_ms),
        card('Maior rajada', rows && readings(rows, 'wind_gust_ms').max))
    case 'pressure':
    case 'absolutePressure':
      return indicators.concat(range(title, stats?.min, stats?.avg, stats?.max))
    case 'solar':
      return indicators.concat(card('Radiação média', stats?.avg), card('Pico de radiação', stats?.max), {
        title: 'Horário do pico', value: stats?.peakTime ? dateTime(stats.peakTime) : stats ? 'Sem dados' : missing,
      })
    case 'rain': {
      // The history endpoint orders all pages by measurement time, newest first.
      const latest = rows?.find(row => Number.isFinite(row.daily_rain_mm))
      return indicators.concat({
        ...card('Último acumulado diário', rows ? latest?.daily_rain_mm ?? null : undefined),
        detail: latest ? `Leitura de ${dateTime(latest.measured_at_utc)} (Recife)` : undefined,
      })
    }
  }
}
