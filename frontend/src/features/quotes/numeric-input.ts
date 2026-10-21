export type NumericRules = { min?: number; max?: number; strictlyPositive?: boolean }

function decimalParts(value: string, places: number) {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return null
  if (!new RegExp(`^[+-]?\\d+(?:\\.\\d{1,${places}})?$`).test(normalized)) throw new RangeError('Informe um número válido, sem separador de milhar.')
  return normalized
}
function checkRange(value: number, { min, max, strictlyPositive }: NumericRules) {
  if (!Number.isFinite(value) || (strictlyPositive && value <= 0) || (min !== undefined && value < min) || (max !== undefined && value > max)) throw new RangeError('Valor fora do intervalo permitido.')
  return value
}
export function parseDecimalInput(value: string, places: 2 | 3 | 6, rules: NumericRules = {}): number | null {
  const normalized = decimalParts(value, places)
  return normalized === null ? null : checkRange(Number(normalized), rules)
}
export function parseMoneyInput(value: string, rules: NumericRules = {}): number | null {
  const normalized = decimalParts(value, 2)
  if (normalized === null) return null
  const [whole, fraction = ''] = normalized.replace(/^[+-]/, '').split('.')
  const magnitude = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  const cents = normalized.startsWith('-') ? -magnitude : magnitude
  if (cents < -2147483648n || cents > 2147483647n) throw new RangeError('Valor fora do intervalo permitido.')
  return checkRange(Number(cents), rules)
}
