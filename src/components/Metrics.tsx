import { useEffect, useState } from 'react'
import {
  CloudRain,
  Droplets,
  Gauge,
  SunDim,
  Sun,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import type { Observation } from '../data/types'
import { config } from '../config'
import { metric, number } from '../utils/format'

export function Value({
  value,
  unit,
}: {
  value?: number | null
  unit: string
}) {
  return value == null || !Number.isFinite(value) ? (
    <span className="unavailable">—</span>
  ) : (
    <>
      {number(value)}
      {unit && <small> {unit}</small>}
    </>
  )
}
function MetricScale({ value, min, max, unit }: {
  value?: number | null; min: number; max: number; unit: string
}) {
  if (value == null || !Number.isFinite(value) || max <= min) return null
  const percent = Math.min(100, Math.max(0, 100 * (value - min) / (max - min)))
  return <div className="metric-scale">
    <span className="scale-track" aria-hidden="true"><i style={{ width: percent + '%' }} /></span>
    <small>Escala de referência · {number(min)}–{metric(max, unit)}</small>
  </div>
}

type CardProps = {
  title: string
  icon: LucideIcon
  color: string
  value?: number | null
  unit: string
  children: React.ReactNode
  visual?: React.ReactNode
}
export function MetricCard({
  title,
  icon: Icon,
  color,
  value,
  unit,
  children,
  visual,
}: CardProps) {
  return (
    <article className={'metric-card tone-' + color + (value == null ? ' metric-missing' : '')}>
      <div className="card-label">
        <span className="icon-box">
          <Icon size={20} strokeWidth={1.7} />
        </span>
        <h3>{title}</h3>
      </div>
      <div className="metric-reading">
        <Value value={value} unit={unit} />
      </div>
      {value == null ? <p className="sensor-missing">Sensor sem leitura</p> : visual}
      <div className="card-detail">{children}</div>
    </article>
  )
}
export default function Metrics({ row }: { row?: Observation | null }) {
  // Establish the order with the first sample and keep it through subsequent polls.
  const [initialSample, setInitialSample] = useState(row)
  useEffect(() => {
    if (!initialSample && row) setInitialSample(row)
  }, [initialSample, row])
  const first = initialSample ?? row
  const direction = row?.wind_direction_deg
  const useAbsolute =
    row?.relative_pressure_hpa == null && row?.absolute_pressure_hpa != null
  const cards = [
    { initialValue: first?.outdoor_humidity_pct, card: <MetricCard key="Umidade do ar"
      title="Umidade do ar"
      icon={Droplets}
      color="blue"
      value={row?.outdoor_humidity_pct}
      unit="%"
      visual={<MetricScale value={row?.outdoor_humidity_pct} min={0} max={100} unit="%" />}
    >
      Umidade relativa externa
    </MetricCard> },
    { initialValue: first?.wind_speed_ms, card: <MetricCard key="Vento"
      title="Velocidade do vento"
      icon={Wind}
      color="teal"
      value={row?.wind_speed_ms}
      unit="m/s"
      visual={<MetricScale value={row?.wind_speed_ms} {...config.windScale} unit="m/s" />}
    >
      {row?.wind_gust_ms == null && direction == null ? (
        'Velocidade do vento'
      ) : (
        <>
          Rajada {metric(row?.wind_gust_ms, 'm/s')} · Direção{' '}
          {metric(direction, '°')}
        </>
      )}
    </MetricCard> },
    { initialValue: first?.daily_rain_mm, card: <MetricCard key="Precipitação"
      title="Precipitação"
      icon={CloudRain}
      color="indigo"
      value={row?.daily_rain_mm}
      unit="mm"
    >
      Acumulado do dia · Última hora:{' '}
      {metric(row?.hourly_rain_mm, 'mm')}
      {row &&
        [row.weekly_rain_mm, row.monthly_rain_mm, row.yearly_rain_mm].some(
          (v) => v != null,
        ) && (
          <details className="accumulations">
            <summary>Outros acumulados</summary>
            <p>
              Semana {metric(row.weekly_rain_mm, 'mm')} · Mês{' '}
              {metric(row.monthly_rain_mm, 'mm')} · Ano{' '}
              {metric(row.yearly_rain_mm, 'mm')}
            </p>
          </details>
        )}
    </MetricCard> },
    { initialValue: first?.relative_pressure_hpa ?? first?.absolute_pressure_hpa, card: <MetricCard key="Pressão atmosférica"
      title="Pressão atmosférica"
      icon={Gauge}
      color="slate"
      value={
        useAbsolute
          ? row?.absolute_pressure_hpa
          : row?.relative_pressure_hpa
      }
      unit="hPa"
      visual={<MetricScale value={row?.relative_pressure_hpa ?? row?.absolute_pressure_hpa} {...config.pressureScale} unit="hPa" />}
    >
      {useAbsolute ? 'Pressão absoluta' : 'Pressão relativa'}
      {!useAbsolute && row?.absolute_pressure_hpa != null && (
        <> · Absoluta {metric(row.absolute_pressure_hpa, 'hPa')}</>
      )}
    </MetricCard> },
    { initialValue: first?.solar_radiation_wm2, card: <MetricCard key="Radiação solar"
      title="Radiação solar"
      icon={Sun}
      color="amber"
      value={row?.solar_radiation_wm2}
      unit="W/m²"
    >
      Potência solar por área
    </MetricCard> },
    { initialValue: first?.uv_index, card: <MetricCard key="Índice UV"
      title="Índice UV"
      icon={SunDim}
      color="orange"
      value={row?.uv_index}
      unit=""
    >
      Radiação ultravioleta <span>·</span> Adimensional
    </MetricCard> },
  ]
  return (
    <section aria-labelledby="sensor-title">
      <div className="section-heading">
        <h2 id="sensor-title">Indicadores meteorológicos</h2>
        <span className="section-rule" />
      </div>
      <div className="sensor-grid">
        {cards.sort((a, b) => Number(a.initialValue == null) - Number(b.initialValue == null)).map(item => item.card)}
      </div>
    </section>
  )
}
