const measure = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })
const quantity = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 })
const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

function formatFinite(value: number, formatter: Intl.NumberFormat): string {
  if (!Number.isFinite(value)) throw new RangeError('Number must be finite')
  return formatter.format(Object.is(value, -0) ? 0 : value)
}

export function formatMeasure(value: number): string {
  return formatFinite(value, measure)
}

export function formatQuantity(value: number): string {
  return formatFinite(value, quantity)
}

export function formatInteger(value: number): string {
  if (!Number.isSafeInteger(value)) throw new RangeError('Number must be a safe integer')
  return integer.format(value)
}
