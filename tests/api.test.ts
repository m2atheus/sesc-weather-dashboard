import { describe, expect, it, vi } from 'vitest'
import { api, ApiError, downloadCsv } from '../src/data/api'
import { row, station, summary } from './fixtures'

const signal = new AbortController().signal
const period = {
  start: '2026-11-20T00:00:00-03:00',
  end: '2026-11-20T23:59:59-03:00',
}
function reply(data: unknown, status = 200) {
  const fetch = vi.fn().mockResolvedValue(Response.json(data, { status }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}
describe('Leitor público', () => {
  it('descobre o ID pelo catálogo e valida o detalhe', async () => {
    const get = reply([station])
    expect(await api.stations(1, signal)).toEqual([station])
    expect(get.mock.calls[0][0]).toContain('/stations?page=1&page_size=25')
    get.mockResolvedValueOnce(Response.json(station))
    expect(await api.station(7, signal)).toEqual(station)
    expect(get.mock.calls[1][0]).toMatch(/\/stations\/7$/)
  })
  it('preserva os campos métricos da observação', async () => {
    reply(row)
    expect(await api.latest(7, signal)).toEqual(row)
  })
  it('distingue os dois erros 404', async () => {
    reply({ detail: 'Estação sem observações' }, 404)
    expect(await api.latest(7, signal)).toBeNull()
    reply({ detail: 'Estação desconhecida' }, 404)
    await expect(api.latest(7, signal)).rejects.toMatchObject({ status: 404 })
  })
  it('rejeita cadastro interno e sensor inválido', async () => {
    reply({ ...station, is_simulated: undefined })
    await expect(api.station(7, signal)).rejects.toBeInstanceOf(ApiError)
    reply({ ...row, outdoor_temperature_c: '30.5' })
    await expect(api.latest(7, signal)).rejects.toBeInstanceOf(ApiError)
  })
  it('mantém período, ordem e cancelamento ao avançar a página', async () => {
    const get = reply({ page: 2, page_size: 100, items: [] })
    expect((await api.history(7, period, 2, signal)).items).toEqual([])
    const url = new URL(get.mock.calls[0][0], 'http://localhost')
    expect(url.pathname).toMatch(/\/stations\/7\/observations$/)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      ...period,
      order: 'desc',
      page: '2',
    })
    expect(get.mock.calls[0][1].signal).toBe(signal)
  })
  it('obtém o resumo do período no servidor', async () => {
    const get = reply(summary)
    expect(await api.summary(7, period, signal)).toEqual(summary)
    expect(get.mock.calls[0][0]).toContain('/stations/7/summary?')
  })
  it('entrega o arquivo CSV do servidor com os filtros inclusivos', async () => {
    const csv =
      'Medição (UTC),Chuva acumulada diária (mm)\r\n2026-11-20T15:00:00Z,0\r\n'
    const response = new Response(csv, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    })
    const readBlob = vi.spyOn(response, 'blob')
    const get = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', get)
    const create = vi.fn().mockReturnValue('blob:csv')
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: create,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    await downloadCsv(7, period, signal)
    expect(click).toHaveBeenCalledOnce()
    const downloaded = await readBlob.mock.results[0].value
    expect(create.mock.calls[0][0]).toBe(downloaded)
    expect(downloaded.size).toBe(new TextEncoder().encode(csv).byteLength)
    const url = new URL(get.mock.calls[0][0], 'http://localhost')
    expect(url.pathname).toMatch(/\/stations\/7\/export.csv$/)
    expect(Object.fromEntries(url.searchParams)).toEqual(period)
  })
  it('propaga o limite de exportação antes de criar um arquivo', async () => {
    reply({ detail: 'Reduza o período para exportar menos linhas' }, 422)
    await expect(downloadCsv(7, period, signal)).rejects.toMatchObject({
      status: 422,
    })
  })
  it('respeita Retry-After inclusive em tentativas manuais', async () => {
    const get = vi
      .fn()
      .mockResolvedValue(
        new Response('{}', { status: 429, headers: { 'Retry-After': '60' } }),
      )
    vi.stubGlobal('fetch', get)
    await expect(api.latest(7, signal)).rejects.toMatchObject({ status: 429 })
    await expect(api.stations(1, signal)).rejects.toMatchObject({ status: 429 })
    expect(get).toHaveBeenCalledTimes(1)
  })
})
