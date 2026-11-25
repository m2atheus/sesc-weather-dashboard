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
const tooltip = {
  padding: '8px 12px',
  borderRadius: 8,
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--line)',
  color: 'var(--ink)',
  fontSize: 13,
}
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
  const series = variable === 'wind'
  return (
    <figure
      aria-label={style.title + ' por horário da medição, em ' + style.unit}
    >
      <div className="plot-caption">
        {/* The compact overview chart has a single series named by its panel title. */}
        {(!compact || series) && (
          <span>
            <i style={{ background: style.color }} aria-hidden="true" />
            {style.title} ({style.unit})
          </span>
        )}
        {series && (
          <span>
            <i className="dashed-key" aria-hidden="true" />
            Rajadas (m/s)
          </span>
        )}
        {points.length > rows.length && <small>Traçado interrompido em intervalos acima de 30 min</small>}
      </div>
      <div className={'plot ' + (compact ? 'plot-compact' : '')}>
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 300, height: compact ? 168 : 320 }}
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
            <CartesianGrid vertical={false} stroke="var(--line)" />
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
              width={compact ? 56 : 72}
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
              cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
              contentStyle={tooltip}
              labelStyle={{ color: 'var(--muted)', marginBottom: 4 }}
              itemStyle={{ padding: 0, fontWeight: 600 }}
            />
            <Area
              type="linear"
              dataKey={style.key}
              name={style.title}
              stroke={style.color}
              strokeWidth={2}
              fill={'url(#' + grad + ')'}
              dot={
                points.length === 1 || points.some((p) => p[style.key] == null)
                  ? { r: 3, strokeWidth: 0, fill: style.color }
                  : false
              }
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: style.color }}
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
                strokeWidth={1.75}
                fill="none"
                dot={
                  points.length === 1 ||
                  points.some((p) => p.wind_gust_ms == null)
                    ? { r: 3, strokeWidth: 0, fill: 'var(--plot-gust)' }
                    : false
                }
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: 'var(--plot-gust)' }}
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
