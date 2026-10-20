// Monetary values are represented as integer cents. The range mirrors the
// PostgreSQL Int (32-bit) columns used by the persistence model; operations
// compute with BigInt and reject results outside that range instead of
// silently truncating.

export const MONEY_MIN_CENTS = -2_147_483_648;
export const MONEY_MAX_CENTS = 2_147_483_647;

const MICRO_UNITS_PER_CENT = 1_000_000n;

export class Money {
  private constructor(readonly cents: number) {}

  static fromCents(cents: number): Money {
    assertInteger(cents, 'Money cents');
    assertRange(BigInt(cents));

    return new Money(cents);
  }

  static zero(): Money {
    return new Money(0);
  }

  add(other: Money): Money {
    return Money.fromCents(
      checkedNumber(BigInt(this.cents) + BigInt(other.cents)),
    );
  }

  subtract(other: Money): Money {
    return Money.fromCents(
      checkedNumber(BigInt(this.cents) - BigInt(other.cents)),
    );
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  isZero(): boolean {
    return this.cents === 0;
  }

  isPositive(): boolean {
    return this.cents > 0;
  }

  isNegative(): boolean {
    return this.cents < 0;
  }
}

// total = HALF_UP(quantityMicro × unitPriceCents / 1_000_000)
export function calculateItemTotalCents(
  quantityMicro: number | bigint,
  unitPriceCents: number,
): number {
  const quantity = toBigInt(quantityMicro, 'Item quantity');
  const unitPrice = toBigInt(unitPriceCents, 'Item unit price');
  const total = divideHalfUp(quantity * unitPrice, MICRO_UNITS_PER_CENT);

  return checkedNumber(total);
}

// Integer division with HALF_UP rounding. The quotient is computed on the
// absolute value so that ties round away from zero for negative numerators.
export function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new RangeError('Denominator must be positive');
  }

  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  let quotient = absolute / denominator;
  const remainder = absolute % denominator;

  if (remainder * 2n >= denominator) {
    quotient += 1n;
  }

  return negative ? -quotient : quotient;
}

function checkedNumber(value: bigint): number {
  assertRange(value);

  return Number(value);
}

function assertRange(value: bigint): void {
  if (value < BigInt(MONEY_MIN_CENTS) || value > BigInt(MONEY_MAX_CENTS)) {
    throw new RangeError('Money value is outside the supported range');
  }
}

function assertInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
}

function toBigInt(value: number | bigint, label: string): bigint {
  if (typeof value === 'bigint') {
    return value;
  }

  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }

  return BigInt(value);
}
