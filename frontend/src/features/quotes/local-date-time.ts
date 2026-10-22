import { DISPLAY_TIME_ZONE } from '@/shared/format/dates'

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: DISPLAY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3, hourCycle: 'h23',
})
export function isoToLocalDateTime(value: string): string {
  const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${parts.fractionalSecond}`
}
export function localDateTimeToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value)) throw new RangeError('Informe data e hora válidas.')
  const calendar = Date.parse(`${value.length === 16 ? `${value}:00` : value}Z`)
  if (!Number.isFinite(calendar) || new Date(calendar).toISOString().slice(0, value.length) !== value) throw new RangeError('Informe data e hora válidas.')
  let instant = calendar
  for (let i = 0; i < 3; i++) instant += calendar - Date.parse(`${isoToLocalDateTime(new Date(instant).toISOString())}Z`)
  if (isoToLocalDateTime(new Date(instant).toISOString()) !== new Date(calendar).toISOString().slice(0, -1)) throw new RangeError('Informe data e hora válidas.')
  return new Date(instant).toISOString()
}
