import { config } from '../config'
import {
  sensors,
  statistics,
  type HistoryPage,
  type Observation,
  type Period,
  type Station,
  type Summary,
  type WeatherService,
} from './types'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAt = 0,
  ) {
    super(message)
  }
}
let retryAfter = 0
export async function request(path: string, signal: AbortSignal) {
  if (Date.now() < retryAfter)
    throw new ApiError(
      429,
      'Limite de consultas atingido. Aguarde para tentar novamente.',
      retryAfter,
    )
  const response = await fetch(config.base + path, {
    signal,
    credentials: 'omit',
    cache: 'no-store',
  })
  if (response.ok) return response
  const body = await response.json().catch(() => null)
  if (response.status === 429) {
    const header = response.headers.get('Retry-After')
    const seconds = header && /^\d+$/.test(header) ? Number(header) : 60
    retryAfter = Date.now() + seconds * 1000
  }
  throw new ApiError(
    response.status,
    typeof body?.detail === 'string'
      ? body.detail
      : 'Falha ao consultar o serviço.',
    retryAfter,
  )
}
function expect(condition: unknown): asserts condition {
  if (!condition)
    throw new ApiError(502, 'Resposta incompatível com o leitor público.')
}
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const instant = (v: unknown) =>
  typeof v === 'string' &&
  /(?:Z|[+-]\d\d:\d\d)$/i.test(v) &&
  Number.isFinite(Date.parse(v))
const positiveId = (v: unknown) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v > 0
const numeric = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

function station(v: unknown): Station {
  expect(
    record(v) &&
      positiveId(v.id) &&
      typeof v.name === 'string' &&
      typeof v.model === 'string' &&
      typeof v.is_simulated === 'boolean' &&
      ['online', 'offline', 'delayed'].some((x) => x === v.communication) &&
      instant(v.last_seen_at) &&
      numeric(v.seconds_since_contact) &&
      (v.last_measured_at_utc === null || instant(v.last_measured_at_utc)) &&
      (v.seconds_since_measurement === null ||
        numeric(v.seconds_since_measurement)),
  )
  return v as unknown as Station
}
function observation(v: unknown): Observation {
  expect(
    record(v) &&
      positiveId(v.id) &&
      positiveId(v.station_id) &&
      instant(v.measured_at_utc) &&
      instant(v.received_at_utc) &&
      sensors.every((key) => v[key] == null || numeric(v[key])),
  )
  return v as unknown as Observation
}
function summary(v: unknown): Summary {
  expect(
    record(v) &&
      Number.isSafeInteger(v.sample_count) &&
      Number(v.sample_count) >= 0 &&
      statistics.every((key) => v[key] === null || numeric(v[key])),
  )
  if (v.latest !== null) observation(v.latest)
  return v as unknown as Summary
}
const json = async (path: string, signal: AbortSignal): Promise<unknown> =>
  (await request(path, signal)).json()
const route = (id: number) => '/stations/' + id
const readerSignal = (signal: AbortSignal) =>
  AbortSignal.any([signal, AbortSignal.timeout(5000)])
const dates = (period: Period) =>
  new URLSearchParams({ start: period.start, end: period.end })
export const api: WeatherService = {
  async stations(page, signal) {
    const data = await json('/stations?page=' + page + '&page_size=25', readerSignal(signal))
    expect(Array.isArray(data))
    return data.map(station)
  },
  async station(id, signal) {
    return station(await json(route(id), readerSignal(signal)))
  },
  async latest(id, signal) {
    try {
      return observation(await json(route(id) + '/latest', signal))
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 404 &&
        err.message === 'Estação sem observações'
      )
        return null
      throw err
    }
  },
  async history(id, period, page, signal): Promise<HistoryPage> {
    const params = dates(period)
    params.set('page', String(page))
    params.set('order', 'desc')
    const v = await json(route(id) + '/observations?' + params, signal)
    expect(
      record(v) &&
        v.page === page &&
        positiveId(v.page_size) &&
        Array.isArray(v.items),
    )
    return {
      page,
      page_size: Number(v.page_size),
      items: v.items.map(observation),
    }
  },
  async summary(id, period, signal) {
    return summary(await json(route(id) + '/summary?' + dates(period), signal))
  },
}
export async function downloadCsv(
  id: number,
  period: Period,
  signal: AbortSignal,
) {
  const response = await request(
    route(id) + '/export.csv?' + dates(period),
    signal,
  )
  expect(response.headers.get('content-type')?.startsWith('text/csv'))
  const blob = await response.blob()
  signal.throwIfAborted()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'estacao-' + id + '.csv'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
