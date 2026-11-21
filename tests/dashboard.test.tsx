import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { config } from '../src/config'
import { Source } from '../src/data/hooks'
import { Dashboard } from '../src/App'
import Metrics from '../src/components/Metrics'
import type { WeatherService } from '../src/data/types'
import { row, service } from './fixtures'

function visit(overrides: Partial<WeatherService> = {}, path = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Source.Provider
          value={{ service: { ...service, ...overrides }, demo: false }}
        >
          <Dashboard toggle={() => {}} />
        </Source.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
it('atualiza a observação por polling sem recarregar a página', async () => {
  vi.useFakeTimers()
  const normalInterval = config.pollMs
  config.pollMs = 100
  const latest = vi
    .fn()
    .mockResolvedValueOnce(row)
    .mockResolvedValue({ ...row, outdoor_temperature_c: 32.8 })
  try {
    visit({
      latest,
      history: async () => ({ page: 1, page_size: 100, items: [] }),
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20)
    })
    expect(screen.getByText('30,5')).toBeTruthy()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120)
    })
    expect(screen.getByText('32,8')).toBeTruthy()
    expect(latest.mock.calls.length).toBeGreaterThanOrEqual(2)
  } finally {
    config.pollMs = normalInterval
    vi.useRealTimers()
  }
})
it('renderiza cartões com campos parciais e chuva igual a zero', () => {
  const { rerender } = render(<Metrics row={row} />)
  const cards = screen.getAllByRole('article')
  expect(cards).toHaveLength(6)
  expect(
    cards.find((c) => within(c).queryByText('Umidade do ar'))?.textContent,
  ).toContain('Sensor sem leitura')
  expect(
    cards.find((c) => within(c).queryByText('Precipitação'))?.textContent,
  ).toContain('0 mm')
  expect(
    cards.find((c) => within(c).queryByText('Pressão atmosférica'))
      ?.textContent,
  ).toContain('1.013,2 hPa')
  const headings = () => screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
  const initialOrder = headings()
  expect(initialOrder.indexOf('Precipitação')).toBeLessThan(initialOrder.indexOf('Umidade do ar'))
  expect(cards.find(c => c.textContent?.includes('Precipitação'))?.textContent).toContain('Última hora: —')
  rerender(<Metrics row={{ ...row, outdoor_humidity_pct: 0, hourly_rain_mm: 0.4 }} />)
  expect(headings()).toEqual(initialOrder)
  expect(screen.getByText(/Última hora: 0,4 mm/)).toBeTruthy()
})
it('detecta a queda e a volta do leitor com a mesma medição em cache', async () => {
  vi.useFakeTimers()
  let available = true
  const station = vi.fn<WeatherService['station']>(async (...args) => {
    if (!available) throw new TypeError('Failed to fetch')
    return { ...await service.station(...args), communication: 'offline' }
  })
  try {
    visit({ station })
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    expect(screen.getByText('API disponível')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Sem comunicação/ })).toBeTruthy()
    available = false
    await act(async () => { await vi.advanceTimersByTimeAsync(15_100) })
    expect(screen.getByText('API indisponível')).toBeTruthy()
    expect(screen.getByText('Leitura em cache')).toBeTruthy()
    expect(screen.getByText('30,5')).toBeTruthy()
    available = true
    await act(async () => { await vi.advanceTimersByTimeAsync(15_100) })
    expect(screen.getByText('API disponível')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Sem comunicação/ })).toBeTruthy()
  } finally {
    vi.useRealTimers()
  }
})
it('indica carregamento antes de receber o catálogo', () => {
  visit({ stations: () => new Promise(() => {}) })
  expect(screen.getByText('Consultando estação…')).toBeTruthy()
})
it('identifica a pressão absoluta quando só esse sensor possui leitura', () => {
  render(
    <Metrics
      row={{
        ...row,
        relative_pressure_hpa: null,
        absolute_pressure_hpa: 962.1,
      }}
    />,
  )
  const pressure = screen
    .getByRole('heading', { name: 'Pressão atmosférica' })
    .closest('article')!
  expect(pressure.textContent).toContain('962,1 hPa')
  expect(pressure.textContent).toContain('Pressão absoluta')
})
it('permite consultar as 24 horas anteriores à última amostra, mantendo sua precisão', async () => {
  const end = '2020-03-15T03:15:00.123456Z'
  const stationDetail = {
    ...(await service.station(7, new AbortController().signal)),
    last_measured_at_utc: end,
  }
  const timestamped = { ...row, measured_at_utc: end }
  const history = vi.fn<WeatherService['history']>(async (_id, _period, page) => ({
    page, page_size: 1, items: page === 1 ? [timestamped] : [],
  }))
  const daily = vi.fn(service.summary)
  visit({ stations: async () => [stationDetail], latest: async () => timestamped,
    station: async () => stationDetail, history, summary: daily })
  await screen.findByText('Exibindo último período ativo')
  expect(history.mock.calls.some(([, period, page]) => period.end === end && page === 2)).toBe(true)
  expect(daily.mock.calls.at(-1)?.[1]).toEqual({
    start: '2020-03-15T03:00:00.000Z', end: '2020-03-16T02:59:59.999999Z',
  })
  expect(screen.getByRole('link', { name: /Explorar histórico completo/ }).getAttribute('href')).toBe('/historico')
})
it('abre o dia civil de Recife a partir de um histórico vazio', async () => {
  const end = '2020-03-15T02:30:00Z'
  const stationDetail = {
    ...(await service.station(7, new AbortController().signal)),
    last_measured_at_utc: end,
  }
  const history = vi
    .fn<WeatherService['history']>()
    .mockResolvedValue({ page: 1, page_size: 100, items: [] })
  visit({ station: async () => stationDetail, history }, '/historico')
  await act(async () => { await vi.dynamicImportSettled() })
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Consultar dia da última medição',
    }),
  )
  await waitFor(() =>
    expect(history.mock.calls.at(-1)?.[1]).toEqual({
      start: '2020-03-14T03:00:00.000Z',
      end: '2020-03-15T02:59:59.999999Z',
    }),
  )
})
it('mantém o erro visível e permite repetir a consulta', async () => {
  const stations = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('network'))
    .mockResolvedValue([])
  visit({ stations })
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await screen.findByText(/Nenhuma estação cadastrada/)
  expect(stations).toHaveBeenCalledTimes(2)
})
it('informa espera pela primeira medição sem simular uma amostra', async () => {
  visit({ latest: async () => null })
  await screen.findByText(/Estação cadastrada. Aguardando a primeira medição/)
  expect(screen.queryByRole('alert')).toBeNull()
})
it('mantém o último valor após falha e identifica a origem simulada da API', async () => {
  const latest = vi
    .fn()
    .mockResolvedValueOnce(row)
    .mockRejectedValue(new Error('network'))
  visit({ latest })
  await screen.findByText('30,5')
  const badge = screen.getByRole('button', { name: /Simulador.*Detalhes da estação/ })
  fireEvent.click(badge)
  expect(screen.getByText('Simulador da estação')).toBeTruthy()
  fireEvent.click(badge)
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
  await screen.findByRole('alert')
  expect(screen.getByText('30,5')).toBeTruthy()
})
it('navega pelas páginas, consulta o histórico, alterna variável e aplica filtros', async () => {
  const history = vi.fn(service.history)
  visit({ history })
  fireEvent.click(screen.getByRole('link', { name: 'Histórico' }))
  await screen.findByRole('heading', { name: 'Histórico meteorológico' })
  await screen.findByText(/1 medição nesta página/)
  fireEvent.click(screen.getByRole('button', { name: '7 dias' }))
  await waitFor(() => {
    const p = history.mock.calls.at(-1)![1]
    expect(Date.parse(p.end) - Date.parse(p.start)).toBe(7 * 86400000)
  })
  fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }))
  fireEvent.change(screen.getByLabelText('Data inicial'), {
    target: { value: '2026-11-20' },
  })
  fireEvent.change(screen.getByLabelText('Data final'), {
    target: { value: '2026-11-20' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar período' }))
  await waitFor(() =>
    expect(history.mock.calls.at(-1)![1].start).toBe(
      '2026-11-20T03:00:00.000Z',
    ),
  )
  fireEvent.change(screen.getByLabelText('Grandeza meteorológica'), {
    target: { value: 'wind' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Tabela' }))
  await screen.findByRole('columnheader', { name: 'Rajadas (m/s)' })
  expect(screen.getByRole('table').textContent).toContain('4,2')
  fireEvent.click(screen.getByRole('link', { name: 'Sobre' }))
  await screen.findByRole('heading', { name: 'Sobre a estação' })
  fireEvent.click(screen.getByRole('link', { name: 'Visão geral' }))
  await screen.findByRole('heading', { name: 'Visão geral' })
})
it('resume todas as páginas por variável e acompanha a troca de período', async () => {
  const first = { ...row, daily_rain_mm: 5, absolute_pressure_hpa: 970, solar_radiation_wm2: 0 }
  const second = { ...first, id: 42, measured_at_utc: '2026-11-20T18:30:00Z',
    relative_pressure_hpa: null, absolute_pressure_hpa: 960, solar_radiation_wm2: 650, wind_gust_ms: 8 }
  const history: WeatherService['history'] = async (_station, period, page) => {
    const week = Date.parse(period.end) - Date.parse(period.start) > 86400000
    return { page, page_size: 1, items: page === 1 ? [second] : page === 2 && week ? [first] : [] }
  }
  const summary: WeatherService['summary'] = async (...args) => ({
    ...await service.summary(...args),
    sample_count: Date.parse(args[1].end) - Date.parse(args[1].start) > 86400000 ? 2 : 1,
  })
  visit({ history, summary }, '/historico')
  const group = within(await screen.findByRole('group', { name: 'Resumo do período inteiro' }))
  const check = async (label: string, value: string) => {
    await waitFor(() => expect(group.getByText(label).parentElement!.querySelector('b')?.textContent).toBe(value))
  }
  const select = (value: string) => fireEvent.change(screen.getByLabelText('Grandeza meteorológica'), { target: { value } })
  await check('Medições no período', '1')
  await check('Temperatura média', '30,5 °C')
  fireEvent.click(screen.getByRole('button', { name: '7 dias' }))
  await check('Medições no período', '2')
  select('humidity')
  await check('Medições no período', '0')
  await check('Umidade média', 'Sem dados')
  select('wind')
  await check('Velocidade média', '4,2 m/s')
  await check('Maior rajada', '8 m/s')
  select('rain')
  await check('Último acumulado diário', '5 mm')
  expect(group.getByText('Leitura de 20/11/2026, 15:30 (Recife)')).toBeTruthy()
  expect(group.getAllByText(/./, { selector: 'b' })).toHaveLength(2)
  select('pressure')
  await check('Medições no período', '1')
  await check('Pressão relativa média', '1.013,2 hPa')
  select('absolutePressure')
  await check('Pressão absoluta média', '965 hPa')
  select('solar')
  await check('Radiação média', '325 W/m²')
  await check('Pico de radiação', '650 W/m²')
  await check('Horário do pico', '20/11/2026, 15:30')
  fireEvent.click(screen.getByRole('button', { name: 'Tabela' }))
  fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
  await waitFor(() => expect(screen.getByRole('table').textContent).toContain('12:00'))
  await check('Radiação média', '325 W/m²')
  select('temperature')
  await check('Temperatura máxima', '30,5 °C')
})
