const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatMoney(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError('Money must be a safe integer in cents')
  }

  const value = BigInt(cents)
  const magnitude = value < 0n ? -value : value
  const whole = value / 100n
  const negativeFraction = value < 0n && whole === 0n
  const fraction = (magnitude % 100n).toString().padStart(2, '0')

  return currency.formatToParts(negativeFraction ? -1n : whole).map((part) => {
    if (part.type === 'fraction') return fraction
    if (negativeFraction && part.type === 'integer') return '0'
    return part.value
  }).join('')
}
