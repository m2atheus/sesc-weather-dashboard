import { describe, expect, it } from 'vitest'
import {
  calendarPeriod,
  dateTime,
  hour,
  localDay,
  metric,
  readingAge,
} from '../src/utils/format'

describe('Apresentação de medidas', () => {
  it.each([
    [30.5, '°C', '30,5 °C'],
    [4.2, 'm/s', '4,2 m/s'],
    [0, 'mm', '0 mm'],
    [12.84, 'mm', '12,8 mm'],
    [1013.2, 'hPa', '1.013,2 hPa'],
    [null, '%', '—'],
    [undefined, '°C', '—'],
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
it('calcula a idade pelo instante real, inclusive com offset explícito', () => {
  const utc = Date.parse('2026-11-21T23:00:00Z')
  expect(readingAge('2026-11-18T20:00:00-03:00', utc)).toBe('há 3 dias')
  expect(readingAge('2026-11-21T22:59:00Z', utc)).toBe('há 1 minuto')
  expect(readingAge('2026-11-21T23:00:00Z', utc)).toBe('agora')
  expect(metric(NaN, 'mm')).toBe('—')
})
