import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { historyIndicators, readPeriodRows } from '../data/historyIndicators'
import { useSource, useSummary } from '../data/hooks'
import type { Period } from '../data/types'
import type { Variable } from '../data/variables'
import { Feedback } from './Feedback'

const statusValues = new Set(['Carregando…', 'Indisponível', 'Sem dados'])

export function HistoryIndicators({ stationId, period, variable }: {
  stationId: number; period: Period; variable: Variable
}) {
  const { demo, service } = useSource()
  const summary = useSummary(stationId, period, true)
  const totals = summary.data
  const observations = useQuery({
    queryKey: [demo, 'indicator-readings', stationId, period, totals?.sample_count, totals?.latest?.id],
    enabled: !!totals && !summary.isError,
    queryFn: ({ signal }) => readPeriodRows(service, stationId, period, totals!.sample_count, signal),
    staleTime: 300_000,
  })
  const cards = useMemo(() => historyIndicators(variable, summary.isError ? undefined : totals,
    observations.isError || summary.isError ? undefined : observations.data,
    !summary.isError && (summary.isPending || observations.isPending)),
    [variable, totals, summary.isError, summary.isPending, observations.data, observations.isError, observations.isPending])
  return <>
    <Feedback error={summary.error || observations.error} retry={() => {
      void summary.refetch()
      if (observations.isError) void observations.refetch()
    }} />
    <div className="summary-grid" role="group" aria-label="Resumo do período inteiro">
      {cards.map(({ title, value, detail }) => (
        <div className="summary-cell" key={title}>
          <span>{title}</span>
          <b className={statusValues.has(value) ? 'missing-stat' : undefined}>{value}</b>
          {detail && <span>{detail}</span>}
        </div>
      ))}
    </div>
    {variable === 'rain' && <p className="period-caption">O valor mostra a chuva acumulada desde o início do dia de medição da estação.</p>}
  </>
}
