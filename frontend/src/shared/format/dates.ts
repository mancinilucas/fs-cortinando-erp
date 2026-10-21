export const DISPLAY_TIME_ZONE = 'America/Sao_Paulo'

const options = { timeZone: DISPLAY_TIME_ZONE } as const
const date = new Intl.DateTimeFormat('pt-BR', {
  ...options, day: '2-digit', month: '2-digit', year: 'numeric',
})
const time = new Intl.DateTimeFormat('pt-BR', {
  ...options, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

function parseInstant(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new RangeError('Date must be an ISO instant with an explicit time zone')
  }
  const calendar = value.slice(0, 10)
  const calendarDate = new Date(`${calendar}T00:00:00Z`)
  if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== calendar) {
    throw new RangeError('Invalid calendar date')
  }
  const instant = new Date(value)
  if (!Number.isFinite(instant.getTime())) throw new RangeError('Invalid date')
  return instant
}

export function formatDate(value: string): string {
  return date.format(parseInstant(value))
}

export function formatTime(value: string): string {
  return time.format(parseInstant(value))
}

export function formatDateTime(value: string): string {
  const instant = parseInstant(value)
  return `${date.format(instant)} às ${time.format(instant)}`
}
