import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  History,
  CalendarDays,
  Clock3,
  Droplets,
  Radio,
  Thermometer,
  TrendingUp,
} from 'lucide-react'
import Metrics, { Value } from '../components/Metrics'
import { EmptyPlot, Feedback } from '../components/Feedback'
import { useHistory } from '../data/hooks'
import type { Observation, Station } from '../data/types'
import { dateTime, fullDay, metric, rollingPeriod } from '../utils/format'
const Plot = lazy(() => import('../components/Plot'))

export default function Overview({
  station,
  row,
  status,
  successAt,
}: {
  station?: Station
  row?: Observation | null
  status: string
  successAt: number
}) {
  const [showRecordedDay, setShowRecordedDay] = useState(false)
  const recordedAt = station?.last_measured_at_utc
  const selectedEnd = showRecordedDay ? recordedAt : null
  const period = useMemo(() => {
    if (!selectedEnd) return rollingPeriod(1, successAt || Date.now())
    // Keep the API's timestamp precision at the inclusive end of the window.
    return { ...rollingPeriod(1, Date.parse(selectedEnd)), end: selectedEnd }
  }, [selectedEnd, successAt])
  const recent = useHistory(station?.id, period, 1)
  return (
    <>
      <div className="page-heading" data-enter>
        <h1>Visão geral</h1>
        <p className="date-line">
          <CalendarDays size={16} />
          {fullDay(Date.now())}
        </p>
      </div>
      <div className="overview-top">
        <section className="hero" aria-labelledby="temp-title" data-enter>
          <div className="hero-grid" aria-hidden="true" />
          <img
            className="station-art"
            src="/estacao-esquema.svg"
            width="310"
            height="218"
            alt=""
          />
          <div className="equipment-plate">
            <Radio size={14} />
            Ambient Weather WS-2000
          </div>
          <div className="hero-body">
            <div className="hero-label">
              <Thermometer size={19} />
              <h2 id="temp-title">Temperatura externa</h2>
            </div>
            <div className="hero-reading">
              {status === 'Carregando' ? (
                <span className="reading-skeleton" aria-hidden="true" />
              ) : (
                <Value value={row?.outdoor_temperature_c} unit="°C" />
              )}
            </div>
            <div className="hero-aux">
              <span>
                <Droplets size={16} />
                Umidade{' '}
                <strong>{metric(row?.outdoor_humidity_pct, '%')}</strong>
              </span>
              <span>
                <Thermometer size={16} />
                Interna{' '}
                <strong>{metric(row?.indoor_temperature_c, '°C')}</strong>
              </span>
            </div>
          </div>
          <div className="hero-bottom">
            <span>
              <Clock3 size={15} />
              {row
                ? 'Medição em ' + dateTime(row.measured_at_utc)
                : 'Aguardando medição'}
            </span>
            <span className="hero-status">
              <i />
              {status}
            </span>
          </div>
        </section>
        <section className="panel recent">
          <div className="panel-heading">
            <span className="section-icon">
              <TrendingUp size={18} />
            </span>
            <h2>Temperatura recente</h2>
          </div>
          <p className="panel-sub">
            {showRecordedDay && recordedAt
              ? '24 horas até ' + dateTime(recordedAt)
              : 'Últimas 24 horas · Horário de Recife'}
          </p>
          {!station ? (
            <div className="chart-empty">
              <Activity size={28} />
              Aguardando dados da estação
            </div>
          ) : recent.isPending || recent.isError ? (
            <Feedback
              busy={recent.isPending}
              error={recent.error}
              retry={() => recent.refetch()}
            />
          ) : !recent.data?.items.length ? (
            <EmptyPlot message="Nenhuma medição neste período." />
          ) : (
            <Suspense fallback={<Feedback busy />}>
              <Plot rows={recent.data.items} variable="temperature" compact />
            </Suspense>
          )}
          <div className="chart-actions">
            {recordedAt &&
              (showRecordedDay ||
                Date.parse(recordedAt) < Date.parse(period.start)) && (
                <button onClick={() => setShowRecordedDay(!showRecordedDay)}>
                  <History size={15} />
                  {showRecordedDay
                    ? 'Voltar às últimas 24 h'
                    : 'Ver últimas leituras'}
                </button>
              )}
            <Link to="/historico">Consultar histórico</Link>
          </div>
        </section>
      </div>
      <Metrics row={row} />
    </>
  )
}
