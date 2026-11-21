import {
  CloudRain,
  Droplets,
  Gauge,
  Navigation2,
  SunDim,
  Sun,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import type { Observation } from '../data/types'
import { metric, number } from '../utils/format'

export function Value({
  value,
  unit,
}: {
  value?: number | null
  unit: string
}) {
  return value == null ? (
    <span className="unavailable">Indisponível</span>
  ) : (
    <>
      {number(value)}
      {unit && <small> {unit}</small>}
    </>
  )
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
    <article className={'metric-card tone-' + color}>
      <div className="card-label">
        <span className="icon-box">
          <Icon size={20} strokeWidth={1.7} />
        </span>
        <h3>{title}</h3>
      </div>
      <div className="metric-reading">
        <Value value={value} unit={unit} />
        {visual}
      </div>
      <div className="card-detail">{children}</div>
    </article>
  )
}
export default function Metrics({ row }: { row?: Observation | null }) {
  const direction = row?.wind_direction_deg
  const useAbsolute =
    row?.relative_pressure_hpa == null && row?.absolute_pressure_hpa != null
  return (
    <section aria-labelledby="sensor-title">
      <div className="section-heading">
        <h2 id="sensor-title">Indicadores meteorológicos</h2>
        <span className="section-rule" />
      </div>
      <div className="sensor-grid">
        <MetricCard
          title="Umidade do ar"
          icon={Droplets}
          color="blue"
          value={row?.outdoor_humidity_pct}
          unit="%"
          visual={
            row?.outdoor_humidity_pct != null && (
              <span className="humidity-track" aria-hidden="true">
                <i
                  style={{
                    width:
                      Math.max(0, Math.min(row.outdoor_humidity_pct, 100)) +
                      '%',
                  }}
                />
              </span>
            )
          }
        >
          Umidade relativa externa
        </MetricCard>
        <MetricCard
          title="Vento"
          icon={Wind}
          color="teal"
          value={row?.wind_speed_ms}
          unit="m/s"
          visual={
            direction != null && (
              <span className="compass" aria-hidden="true">
                <Navigation2
                  size={22}
                  style={{ transform: 'rotate(' + direction + 'deg)' }}
                />
              </span>
            )
          }
        >
          {row?.wind_gust_ms == null && direction == null ? (
            'Velocidade do vento'
          ) : (
            <>
              Rajada {metric(row?.wind_gust_ms, 'm/s')} · Direção{' '}
              {metric(direction, '°')}
            </>
          )}
        </MetricCard>
        <MetricCard
          title="Precipitação"
          icon={CloudRain}
          color="indigo"
          value={row?.daily_rain_mm}
          unit="mm"
        >
          Acumulado do dia <span>·</span> Hora{' '}
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
        </MetricCard>
        <MetricCard
          title="Pressão atmosférica"
          icon={Gauge}
          color="slate"
          value={
            useAbsolute
              ? row?.absolute_pressure_hpa
              : row?.relative_pressure_hpa
          }
          unit="hPa"
        >
          {useAbsolute ? 'Pressão absoluta' : 'Pressão relativa'}
          {!useAbsolute && row?.absolute_pressure_hpa != null && (
            <> · Absoluta {metric(row.absolute_pressure_hpa, 'hPa')}</>
          )}
        </MetricCard>
        <MetricCard
          title="Radiação solar"
          icon={Sun}
          color="amber"
          value={row?.solar_radiation_wm2}
          unit="W/m²"
        >
          Potência solar por área
        </MetricCard>
        <MetricCard
          title="Índice UV"
          icon={SunDim}
          color="orange"
          value={row?.uv_index}
          unit=""
        >
          Radiação ultravioleta <span>·</span> Adimensional
        </MetricCard>
      </div>
    </section>
  )
}
