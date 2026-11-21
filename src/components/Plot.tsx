import { useId, useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EmptyPlot } from './Feedback'
import type { Observation } from '../data/types'
import { dateTime, hour, number, timezone } from '../utils/format'

import { variables, type Variable } from '../data/variables'

const dateShort = new Intl.DateTimeFormat('pt-BR', {
  timeZone: timezone,
  day: '2-digit',
  month: '2-digit',
})
export default function Plot({
  rows,
  variable,
  compact = false,
}: {
  rows: Observation[]
  variable: Variable
  compact?: boolean
}) {
  const style = variables[variable]
  const grad = useId().replace(/:/g, '')
  const points = useMemo(() => {
    const sorted = rows.map(row => ({ ...row, time: Date.parse(row.measured_at_utc) }))
      .sort((a, b) => a.time - b.time)
    const result: (Partial<Observation> & { time: number })[] = []
    for (const point of sorted) {
      const previous = result.at(-1)
      if (previous && point.time - previous.time > 30 * 60_000) {
        // A null break separates recordings; it has no plotted or tooltip value.
        result.push({ time: previous.time + (point.time - previous.time) / 2 })
      }
      result.push(point)
    }
    return result
  }, [rows])
  if (
    !points.some(
      (p) =>
        p[style.key] != null || (variable === 'wind' && p.wind_gust_ms != null),
    )
  )
    return (
      <EmptyPlot
        message={
          rows.length
            ? 'Sensor sem leitura nesta página.'
            : 'Nenhuma medição neste período.'
        }
      />
    )
  const longSpan = points[points.length - 1].time - points[0].time > 86_400_000
  const tick = (v: number) => (longSpan ? dateShort.format(v) : hour(v))
  const axes = { fontSize: 12, fill: 'var(--muted)', fontFamily: 'inherit' }
  return (
    <figure
      aria-label={style.title + ' por horário da medição, em ' + style.unit}
    >
      <div className="plot-caption">
        <span>
          <i style={{ background: style.color }} />
          {style.title} ({style.unit})
        </span>
        {variable === 'wind' && (
          <span>
            <i className="dashed-key" />
            Rajadas (m/s)
          </span>
        )}
        {points.length > rows.length && <small>Traçado interrompido em intervalos acima de 30 min</small>}
      </div>
      <div className={'plot ' + (compact ? 'plot-compact' : '')}>
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 300, height: compact ? 124 : 315 }}
        >
          <AreaChart
            data={points}
            accessibilityLayer
            margin={{ top: 10, right: 12, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={style.color} stopOpacity={0.22} />
                <stop
                  offset="100%"
                  stopColor={style.color}
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--line)"
              strokeDasharray="3 4"
            />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={tick}
              minTickGap={32}
              tick={axes}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              width={compact ? 48 : 76}
              unit={' ' + style.unit}
              tickFormatter={number}
              domain={['auto', 'auto']}
              tickCount={compact ? 4 : 6}
              tick={axes}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              isAnimationActive={false}
              labelFormatter={(v) => dateTime(Number(v))}
              formatter={(v, n) => [number(Number(v)) + ' ' + style.unit, n]}
              contentStyle={{
                borderRadius: 8,
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--line)',
                color: 'var(--ink)',
                fontSize: 14,
              }}
            />
            <Area
              type="linear"
              dataKey={style.key}
              name={style.title}
              stroke={style.color}
              strokeWidth={2.4}
              fill={'url(#' + grad + ')'}
              dot={
                points.length === 1 || points.some((p) => p[style.key] == null)
              }
              connectNulls={false}
              isAnimationActive={false}
            />
            {variable === 'wind' && (
              <Area
                type="linear"
                dataKey="wind_gust_ms"
                name="Rajadas"
                stroke="var(--plot-gust)"
                strokeDasharray="5 3"
                strokeWidth={2}
                fill="none"
                dot={
                  points.length === 1 ||
                  points.some((p) => p.wind_gust_ms == null)
                }
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
