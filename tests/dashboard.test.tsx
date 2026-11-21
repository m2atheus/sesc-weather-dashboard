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
  render(<Metrics row={row} />)
  const cards = screen.getAllByRole('article')
  expect(cards).toHaveLength(6)
  expect(
    cards.find((c) => within(c).queryByText('Umidade do ar'))?.textContent,
  ).toContain('Indisponível')
  expect(
    cards.find((c) => within(c).queryByText('Precipitação'))?.textContent,
  ).toContain('0 mm')
  expect(
    cards.find((c) => within(c).queryByText('Pressão atmosférica'))
      ?.textContent,
  ).toContain('1.013,2 hPa')
})
it('indica carregamento antes de receber o catálogo', () => {
  visit({ stations: () => new Promise(() => {}) })
  expect(screen.getByText('Carregando medições…')).toBeTruthy()
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
  const history = vi.fn(service.history)
  visit({ station: async () => stationDetail, history })
  fireEvent.click(
    await screen.findByRole('button', { name: 'Ver últimas leituras' }),
  )
  await waitFor(() => expect(history.mock.calls.at(-1)?.[1].end).toBe(end))
  fireEvent.click(
    screen.getByRole('button', { name: 'Voltar às últimas 24 h' }),
  )
  await screen.findByText('Últimas 24 horas · Horário de Recife')
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
  expect(screen.getByText('Estação simulada')).toBeTruthy()
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
  await screen.findByRole('heading', { name: 'Sobre o observatório' })
  fireEvent.click(screen.getByRole('link', { name: 'Visão geral' }))
  await screen.findByRole('heading', { name: 'Visão geral' })
})
