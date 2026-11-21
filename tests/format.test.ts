import { describe, expect, it } from 'vitest'
import {
  calendarPeriod,
  dateTime,
  hour,
  localDay,
  metric,
} from '../src/utils/format'
import { readingState } from '../src/data/hooks'
import { row, station } from './fixtures'

describe('Apresentação de medidas', () => {
  it.each([
    [30.5, '°C', '30,5 °C'],
    [4.2, 'm/s', '4,2 m/s'],
    [0, 'mm', '0 mm'],
    [12.84, 'mm', '12,8 mm'],
    [1013.2, 'hPa', '1.013,2 hPa'],
    [null, '%', 'Indisponível'],
    [undefined, '°C', 'Indisponível'],
  ] as const)('formata %s %s', (v, unit, expected) =>
    expect(metric(v, unit)).toBe(expected),
  )
  it('exibe em Recife mesmo quando UTC já virou o dia', () => {
    const time = '2026-11-20T01:15:00Z'
    expect(hour(time)).toBe('22:15')
    expect(localDay(Date.parse(time))).toBe('2026-11-19')
    expect(dateTime(time)).toContain('19/11/2026')
  })
  it('consulta o dia civil completo e valida o limite inclusivo', () => {
    expect(calendarPeriod('2026-11-20', '2026-11-20')).toEqual({
      start: '2026-11-20T03:00:00.000Z',
      end: '2026-11-21T02:59:59.999999Z',
    })
    expect(() => calendarPeriod('2026-11-20', '2026-11-19')).toThrow()
    expect(() => calendarPeriod('2026-11-01', '2026-12-02')).toThrow()
    expect(() => calendarPeriod('2026-02-30', '2026-03-01')).toThrow()
  })
})
describe('Situação da estação', () => {
  it('usa a hora da medição exibida para detectar leitura antiga', () => {
    expect(
      readingState(
        station,
        row,
        null,
        Date.parse(row.measured_at_utc) + 180000,
      ),
    ).toBe('Medição desatualizada')
    expect(
      readingState(station, row, null, Date.parse(row.measured_at_utc)),
    ).toBe('Dados atualizados')
  })
  it('distingue falha da API, estação offline e estação sem registros', () => {
    expect(readingState(station, null, null)).toBe('Sem medições')
    expect(
      readingState({ ...station, communication: 'offline' }, row, null),
    ).toBe('Estação sem comunicação')
    expect(readingState(station, row, new Error())).toBe('API indisponível')
  })
})
