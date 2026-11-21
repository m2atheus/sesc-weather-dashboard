import { createContext, useContext } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { config } from '../config'
import { api, ApiError } from './api'
import type { Observation, Period, Station, WeatherService } from './types'

export const Source = createContext<{ service: WeatherService; demo: boolean }>(
  { service: api, demo: false },
)
export const useSource = () => useContext(Source)

function readerInterval(error: Error | null) {
  if (error instanceof ApiError && error.status === 429)
    return Math.max(1000, error.retryAt - Date.now())
  return Math.min(config.pollMs, 15_000)
}

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
    // Once a station exists, its detail request also checks reader availability.
    refetchInterval: (query) =>
      !demo && !query.state.data?.pages[0]?.length
        ? readerInterval(query.state.error)
        : interval(query),
  })
}
export function useCurrent(id?: number) {
  const { service, demo } = useSource()
  const options = {
    enabled: id != null,
    staleTime: config.pollMs,
    refetchInterval: interval,
  }
  const detail = useQuery<Station>({
    ...options,
    refetchInterval: demo ? interval : (query) => readerInterval(query.state.error),
    refetchOnWindowFocus: 'always',
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
export function useSummary(id: number | undefined, period: Period, refresh = false) {
  const { service, demo } = useSource()
  return useQuery({
    queryKey: [demo, 'summary', id, period],
    enabled: id != null,
    queryFn: ({ signal }) => service.summary(id!, period, signal),
    staleTime: 300_000,
    refetchInterval: refresh ? 300_000 : false,
  })
}
// The overview covers one fixed window. History keeps its existing paged view.
export function useTemperatureWindow(id: number | undefined, period: Period) {
  const { service, demo } = useSource()
  return useQuery({
    queryKey: [demo, 'temperature-window', id, period],
    enabled: id != null,
    queryFn: async ({ signal }) => {
      const observations = new Map<number, Observation>()
      for (let page = 1; ; page++) {
        const result = await service.history(id!, period, page, signal)
        for (const row of result.items) observations.set(row.id, row)
        if (result.items.length < result.page_size) break
      }
      return { rows: [...observations.values()], period }
    },
    staleTime: 60_000,
    placeholderData: (previous, query) =>
      query?.queryKey[0] === demo && query.queryKey[2] === id ? previous : undefined,
  })
}
