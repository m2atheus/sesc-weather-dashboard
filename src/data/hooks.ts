import { createContext, useContext } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { config } from '../config'
import { api, ApiError } from './api'
import type { Observation, Period, Station, WeatherService } from './types'

export const Source = createContext<{ service: WeatherService; demo: boolean }>(
  { service: api, demo: false },
)
export const useSource = () => useContext(Source)

function interval(query: {
  state: { error: Error | null; errorUpdateCount: number }
}) {
  const { error, errorUpdateCount } = query.state
  if (!error) return config.pollMs
  if (error instanceof ApiError && error.status === 429)
    return Math.max(config.pollMs, error.retryAt - Date.now())
  return config.pollMs * Math.min(4, 2 ** Math.min(errorUpdateCount, 2))
}
export function useStations() {
  const { service, demo } = useSource()
  return useInfiniteQuery({
    queryKey: [demo, 'stations'],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => service.stations(pageParam, signal),
    getNextPageParam: (page, pages) =>
      page.length === 25 ? pages.length + 1 : undefined,
    staleTime: config.pollMs,
    refetchInterval: interval,
  })
}
export function useCurrent(id?: number) {
  const { service, demo } = useSource()
  const options = {
    enabled: id != null,
    staleTime: config.pollMs,
    refetchInterval: interval,
  }
  const detail = useQuery({
    ...options,
    queryKey: [demo, 'station', id],
    queryFn: ({ signal }) => service.station(id!, signal),
  })
  const latest = useQuery({
    ...options,
    queryKey: [demo, 'latest', id],
    queryFn: ({ signal }) => service.latest(id!, signal),
  })
  return { detail, latest }
}
export function useHistory(
  id: number | undefined,
  period: Period,
  page: number,
) {
  const { service, demo } = useSource()
  return useQuery({
    queryKey: [demo, 'history', id, period, page],
    enabled: id != null,
    queryFn: ({ signal }) => service.history(id!, period, page, signal),
    staleTime: 60_000,
  })
}
export function useSummary(id: number | undefined, period: Period) {
  const { service, demo } = useSource()
  return useQuery({
    queryKey: [demo, 'summary', id, period],
    enabled: id != null,
    queryFn: ({ signal }) => service.summary(id!, period, signal),
    staleTime: 300_000,
  })
}
export function readingState(
  station: Station | undefined,
  row: Observation | null | undefined,
  error: unknown,
  now = Date.now(),
) {
  if (error) return 'API indisponível'
  if (row === undefined) return 'Carregando'
  if (!row) return 'Sem medições'
  if (station?.communication === 'offline') return 'Estação sem comunicação'
  if (station?.communication === 'delayed') return 'Comunicação atrasada'
  if (now - Date.parse(row.measured_at_utc) >= config.staleMs)
    return 'Medição desatualizada'
  return 'Dados atualizados'
}
