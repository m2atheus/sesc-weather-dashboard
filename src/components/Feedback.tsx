import {
  ChartNoAxesCombined,
  CircleAlert,
  LoaderCircle,
  Radio,
} from 'lucide-react'
import { ApiError } from '../data/api'

export function EmptyPlot({ message }: { message: string }) {
  return (
    <div className="chart-empty" role="status">
      <ChartNoAxesCombined size={24} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

/** Reserves the chart's final height while data loads, so the layout does not shift. */
export function PlotSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={'plot plot-skeleton skeleton' + (compact ? ' plot-compact' : '')}
      role="status"
    >
      <span className="sr-only">Carregando gráfico…</span>
    </div>
  )
}

export function Feedback({
  busy,
  error,
  empty,
  retry,
}: {
  busy?: boolean
  error?: unknown
  empty?: string
  retry?: () => void
}) {
  if (error) {
    const detail =
      error instanceof ApiError && [404, 422, 429, 502].includes(error.status)
        ? error.message
        : 'Não foi possível consultar o leitor meteorológico.'
    return (
      <div className="feedback feedback-error" role="alert">
        <CircleAlert size={18} aria-hidden="true" />
        <span>{detail}</span>
        {retry && (
          <button type="button" className="btn btn-secondary" onClick={retry}>
            Tentar novamente
          </button>
        )}
      </div>
    )
  }
  if (busy)
    return (
      <div role="status" className="feedback feedback-loading">
        <LoaderCircle className="spin" size={18} aria-hidden="true" /> Carregando medições…
      </div>
    )
  if (empty)
    return (
      <div role="status" className="feedback feedback-empty">
        <Radio size={18} aria-hidden="true" />
        {empty}
      </div>
    )
  return null
}
