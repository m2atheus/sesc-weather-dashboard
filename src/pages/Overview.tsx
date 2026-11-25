import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUp, Clock3, CloudSun, Minus, Radio } from 'lucide-react'
import Metrics, { Value } from '../components/Metrics'
import { Feedback, PlotSkeleton } from '../components/Feedback'
import { config } from '../config'
import { useSummary, useTemperatureWindow } from '../data/hooks'
import type { Observation, Station } from '../data/types'
import { calendarPeriod, dateTime, dayMs, localDay, metric, readingAge, rollingPeriod, shortDate, signedMetric } from '../utils/format'

const Plot = lazy(() => import('../components/Plot'))

function LastReading({ timestamp }: { timestamp: string }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const old = now - Date.parse(timestamp) >= config.staleMs
  return <time dateTime={timestamp} className={old ? 'older-reading' : undefined}>Última leitura {readingAge(timestamp, now)} · {dateTime(timestamp)}</time>
}

const hourMs = 3_600_000
// A reference reading must sit within this distance of "one hour before".
const trendTolerance = 15 * 60_000

/** Temperature change against the recorded reading closest to one hour earlier. */
function hourlyChange(rows: Observation[], current?: number | null, measuredAt?: string) {
  if (current == null || !Number.isFinite(current) || !measuredAt) return undefined
  const target = Date.parse(measuredAt) - hourMs
  let reference: number | undefined
  let closest = trendTolerance
  for (const point of rows) {
    const value = point.outdoor_temperature_c
    const gap = Math.abs(Date.parse(point.measured_at_utc) - target)
    if (value != null && Number.isFinite(value) && gap <= closest) {
      closest = gap
      reference = value
    }
  }
  return reference == null ? undefined : current - reference
}

function Trend({ change }: { change: number }) {
  if (Math.abs(change) < 0.05) return <><Minus size={14} aria-hidden="true" />Estável</>
  const Icon = change > 0 ? ArrowUp : ArrowDown
  return <><Icon size={14} aria-hidden="true" />{signedMetric(change, '°C')}</>
}

export default function Overview({ station, row, loading, cached, successAt }: {
  station?: Station
  row?: Observation | null
  loading: boolean
  cached: boolean
  successAt: number
}) {
  const measuredAt = row?.measured_at_utc
  const reference = station?.last_measured_at_utc
  const last = reference && (!measuredAt || Date.parse(reference) > Date.parse(measuredAt)) ? reference : measuredAt
  const [openedAt] = useState(Date.now)
  const now = successAt || openedAt
  const historical = !!last && Date.parse(last) < now - dayMs
  const period = useMemo(() => historical && last
    ? { ...rollingPeriod(1, Date.parse(last)), end: last }
    : rollingPeriod(1, now), [historical, last, now])
  const series = useTemperatureWindow(station?.id, period)
  const referenceDay = localDay(measuredAt ? Date.parse(measuredAt) : now)
  const day = useMemo(() => calendarPeriod(referenceDay, referenceDay), [referenceDay])
  const daily = useSummary(measuredAt ? station?.id : undefined, day, referenceDay === localDay(now))
  const rows = useMemo(() => series.data?.rows ?? [], [series.data])
  const hasTemperature = rows.some(point => point.outdoor_temperature_c != null)
  const displayed = series.data?.period ?? period
  const showArchive = Date.parse(displayed.end) < now - dayMs
  const historicalDay = referenceDay !== localDay(now)
  const dayLabel = historicalDay && measuredAt ? 'em ' + shortDate(measuredAt) : 'do dia'
  const change = useMemo(() => hourlyChange(rows, row?.outdoor_temperature_c, measuredAt),
    [rows, row?.outdoor_temperature_c, measuredAt])

  return <>
    <div className="page-heading" data-enter><h1>Visão geral</h1></div>
    <div className="overview-top">
      <section className="hero" aria-labelledby="temp-title" data-enter>
        <div className="hero-grid" aria-hidden="true" />
        <img className="station-art" src="/estacao-esquema.svg" alt="" width="310" height="218" />
        <div className="equipment-plate"><Radio size={14} aria-hidden="true" />Ambient Weather WS-2000</div>
        <div className="hero-body">
          <div className="hero-label"><h2 id="temp-title">Temperatura externa</h2></div>
          <div className="hero-reading">
            {loading ? <span className="skeleton reading-skeleton" role="img" aria-label="Carregando temperatura" /> :
              <Value value={row?.outdoor_temperature_c} unit="°C" />}
          </div>
          {!loading && row?.outdoor_temperature_c == null && <p className="hero-missing">Sensor sem leitura</p>}
          <dl className="hero-stats">
            <div><dt>Sensação térmica</dt><dd title="A estação não fornece esta medição">—<span className="sr-only"> (a estação não fornece esta medição)</span></dd></div>
            <div><dt>Máxima {dayLabel}</dt><dd>{metric(daily.data?.temperature_max_c, '°C')}</dd></div>
            <div><dt>Mínima {dayLabel}</dt><dd>{metric(daily.data?.temperature_min_c, '°C')}</dd></div>
            {change !== undefined && (
              <div><dt>Variação em 1 hora</dt><dd className="trend"><Trend change={change} /></dd></div>
            )}
          </dl>
          {daily.isError && <button type="button" className="hero-retry" onClick={() => daily.refetch()}>Consultar extremos novamente</button>}
        </div>
        <div className="hero-bottom">
          <span><Clock3 size={15} aria-hidden="true" />{measuredAt ? <LastReading timestamp={measuredAt} /> : 'Aguardando primeira leitura'}</span>
          {cached && <span className="tag">Leitura em cache</span>}
        </div>
      </section>
      <section className="recent" aria-labelledby="recent-title">
        <div className="panel-heading"><h2 id="recent-title">Temperatura recente</h2></div>
        {showArchive ? <div className="archive-period"><strong>{rows.length ? 'Exibindo último período ativo' : 'Último período consultado'}</strong>
          <p>{dateTime(displayed.start)} até {dateTime(displayed.end)} · Recife</p></div> :
          <p className="panel-sub">Últimas 24 horas · Horário de Recife</p>}
        {series.error && <Feedback error={series.error} retry={() => series.refetch()} />}
        {hasTemperature ? <Suspense fallback={<PlotSkeleton compact />}><Plot rows={rows} variable="temperature" compact /></Suspense>
          : (loading || (station && series.isPending)) ? <PlotSkeleton compact />
          : !series.error && <div className="temperature-empty"><CloudSun size={24} aria-hidden="true" />
            <p>{!station ? 'Aguardando dados da estação.' : rows.length ? 'Sem leitura de temperatura neste período.' : 'Nenhuma leitura para desenhar o gráfico.'}</p>
            <small>Consulte o histórico quando houver registros.</small></div>}
        <div className="chart-actions"><Link className="text-button" to="/historico">Explorar histórico completo <ArrowRight size={16} aria-hidden="true" /></Link></div>
      </section>
    </div>
    <Metrics key={station?.id} row={row} loading={loading} />
  </>
}
