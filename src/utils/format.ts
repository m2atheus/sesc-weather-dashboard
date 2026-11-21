import { config } from '../config'
import type { Period } from '../data/types'

export const timezone = 'America/Recife'
const dateFmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, ...options })
const timeFmt = dateFmt({ hour: '2-digit', minute: '2-digit' })
const fullFmt = dateFmt({ dateStyle: 'short', timeStyle: 'short' })
const shortDateFmt = dateFmt({ dateStyle: 'short' })
const numberFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
export const number = (value?: number | null) =>
  value == null || !Number.isFinite(value) ? '—' : numberFmt.format(value)
export const metric = (value: number | null | undefined, unit: string) =>
  value == null || !Number.isFinite(value)
    ? '—'
    : [number(value), unit].filter(Boolean).join(' ')
export const hour = (date: string | number) => timeFmt.format(new Date(date))
export const dateTime = (date: string | number) =>
  fullFmt.format(new Date(date))
export const shortDate = (date: string | number) => shortDateFmt.format(new Date(date))
export const dayMs = 86_400_000
const relativeFmt = new Intl.RelativeTimeFormat('pt-BR')
export function readingAge(timestamp: string, now = Date.now()) {
  const delta = Date.parse(timestamp) - now
  const absolute = Math.abs(delta)
  if (absolute < 60_000) return 'agora'
  const [unit, duration] = absolute >= dayMs ? ['day', dayMs] as const
    : absolute >= 3_600_000 ? ['hour', 3_600_000] as const : ['minute', 60_000] as const
  return relativeFmt.format(Math.trunc(delta / duration), unit)
}
export function rollingPeriod(days: number, end = Date.now()): Period {
  return {
    start: new Date(end - days * dayMs).toISOString(),
    end: new Date(end).toISOString(),
  }
}
const isoDayFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
export const localDay = (date: number) => isoDayFmt.format(date)

// Resolve local midnight from the zone database, independently of the visitor's zone.
function midnight(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw new Error('Informe as duas datas.')
  const utc = Date.parse(day + 'T00:00:00Z')
  if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 10) !== day)
    throw new Error('Data inválida.')
  const zone = dateFmt({ timeZoneName: 'longOffset' }).formatToParts(
    utc + dayMs / 2,
  )
  const offset =
    zone
      .find((part) => part.type === 'timeZoneName')!
      .value.replace('GMT', '') || '+00:00'
  return Date.parse(day + 'T00:00:00' + offset)
}
export function calendarPeriod(from: string, to: string): Period {
  const start = midnight(from)
  const followingDay = new Date(midnight(to) + 1.5 * dayMs)
  const endExclusive = midnight(localDay(followingDay.getTime()))
  if (endExclusive <= start)
    throw new Error('A data final deve ser igual ou posterior à inicial.')
  if (endExclusive - start > config.maxDays * dayMs)
    throw new Error('Escolha até ' + config.maxDays + ' dias.')
  return {
    start: new Date(start).toISOString(),
    end: new Date(endExclusive - 1).toISOString().replace('.999Z', '.999999Z'),
  }
}
