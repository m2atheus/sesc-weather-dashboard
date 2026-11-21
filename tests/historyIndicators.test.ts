import { expect, it } from 'vitest'
import { historyIndicators, readPeriodRows } from '../src/data/historyIndicators'
import { row, service, summary } from './fixtures'

it('preserva zeros e distingue um sensor ausente de uma média zero', () => {
  const rows = [{ ...row, outdoor_humidity_pct: 0 }]
  expect(historyIndicators('humidity', { ...summary, humidity_avg_pct: 0 }, rows)[2].value).toBe('0 %')
  expect(historyIndicators('solar', summary, rows)[1].value).toBe('Sem dados')
  expect(historyIndicators('pressure', summary, [])[0].value).toBe('0')
})

it.each([{ items: [] }, { items: [row, row] }])('rejeita conjunto incompleto ou duplicado (%#)', async ({ items }) => {
  const history = async () => ({ page: 1, page_size: 100, items })
  await expect(readPeriodRows({ ...service, history }, 7,
    { start: row.measured_at_utc, end: row.measured_at_utc }, 2, new AbortController().signal)).rejects.toThrow()
})

it('exibe o último acumulado válido mesmo após reset e leitura ausente', () => {
  const rows = [
    { ...row, measured_at_utc: '2026-11-21T04:00:00Z', daily_rain_mm: null },
    { ...row, measured_at_utc: '2026-11-21T03:00:00Z', daily_rain_mm: 0 },
    { ...row, measured_at_utc: '2026-11-21T02:00:00Z', daily_rain_mm: 5.7 },
  ]
  expect(historyIndicators('rain', summary, rows)[1]).toMatchObject({
    value: '0 mm', detail: 'Leitura de 21/11/2026, 00:00 (Recife)',
  })
  expect(historyIndicators('rain', summary, rows.slice(0, 1))[1].value).toBe('Sem dados')
})
