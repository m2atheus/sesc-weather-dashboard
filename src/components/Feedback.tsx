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
      <ChartNoAxesCombined size={28} aria-hidden="true" />
      <span>{message}</span>
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
        <CircleAlert size={18} />
        <span>{detail}</span>
        {retry && (
          <button className="text-button" onClick={retry}>
            Tentar novamente
          </button>
        )}
      </div>
    )
  }
  if (busy)
    return (
      <div role="status" className="feedback feedback-loading">
        <LoaderCircle className="spin" size={18} /> Carregando medições…
      </div>
    )
  if (empty)
    return (
      <div role="status" className="feedback feedback-empty">
        <Radio size={18} />
        {empty}
      </div>
    )
  return null
}
