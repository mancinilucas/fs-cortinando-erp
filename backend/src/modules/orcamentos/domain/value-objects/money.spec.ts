import { describe, expect, it } from 'vitest';
import {
  calculateItemTotalCents,
  divideHalfUp,
  MONEY_MAX_CENTS,
  MONEY_MIN_CENTS,
  Money,
} from './money.js';

describe('Money', () => {
  it('represents zero and positive amounts in cents', () => {
    expect(Money.zero().cents).toBe(0);
    expect(Money.fromCents(12_590).cents).toBe(12_590);
    expect(Money.fromCents(12_590).isPositive()).toBe(true);
  });

  it('represents negative amounts for signed adjustments', () => {
    const money = Money.fromCents(-240);

    expect(money.cents).toBe(-240);
    expect(money.isNegative()).toBe(true);
  });

  it('adds and subtracts without floating point arithmetic', () => {
    const total = Money.fromCents(10).add(Money.fromCents(20));

    expect(total.cents).toBe(30);
    expect(total.subtract(Money.fromCents(30)).isZero()).toBe(true);
    expect(total.subtract(Money.fromCents(35)).cents).toBe(-5);
  });

  it('compares by value', () => {
    expect(Money.fromCents(100).equals(Money.fromCents(100))).toBe(true);
    expect(Money.fromCents(100).equals(Money.fromCents(101))).toBe(false);
  });

  it('accepts the persistence range boundaries', () => {
    expect(Money.fromCents(MONEY_MIN_CENTS).cents).toBe(MONEY_MIN_CENTS);
    expect(Money.fromCents(MONEY_MAX_CENTS).cents).toBe(MONEY_MAX_CENTS);
  });

  it('rejects non-integer and non-finite cents', () => {
    expect(() => Money.fromCents(10.5)).toThrow(RangeError);
    expect(() => Money.fromCents(Number.NaN)).toThrow(RangeError);
    expect(() => Money.fromCents(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('rejects values outside the persistence range', () => {
    expect(() => Money.fromCents(MONEY_MAX_CENTS + 1)).toThrow(RangeError);
    expect(() => Money.fromCents(MONEY_MIN_CENTS - 1)).toThrow(RangeError);
  });

  it('rejects an addition that overflows the persistence range', () => {
    expect(() =>
      Money.fromCents(MONEY_MAX_CENTS).add(Money.fromCents(1)),
    ).toThrow(RangeError);
  });

  it('rejects a subtraction that overflows the persistence range', () => {
    expect(() =>
      Money.fromCents(MONEY_MIN_CENTS).subtract(Money.fromCents(1)),
    ).toThrow(RangeError);
  });
});

describe('calculateItemTotalCents', () => {
  it('multiplies a quantity in millionths by an integer unit price', () => {
    expect(calculateItemTotalCents(1_500_000, 3_000)).toBe(4_500);
    expect(calculateItemTotalCents(2_375_000, 3_790)).toBe(9_001);
  });

  it('returns zero when the product is zero', () => {
    expect(calculateItemTotalCents(0, 12_590)).toBe(0);
    expect(calculateItemTotalCents(1_000_000, 0)).toBe(0);
  });

  it('rounds below half a cent down', () => {
    expect(calculateItemTotalCents(499_999, 1)).toBe(0);
  });

  it('rounds exactly half a cent up', () => {
    expect(calculateItemTotalCents(500_000, 1)).toBe(1);
    expect(calculateItemTotalCents(1_500_000, 1)).toBe(2);
  });

  it('rounds above half a cent up', () => {
    expect(calculateItemTotalCents(500_001, 1)).toBe(1);
  });

  it('rounds HALF_UP away from zero for negative values', () => {
    expect(calculateItemTotalCents(-500_000, 1)).toBe(-1);
    expect(calculateItemTotalCents(-499_999, 1)).toBe(0);
  });

  it('does not introduce binary floating point error', () => {
    expect(calculateItemTotalCents(100_000, 10)).toBe(1);
    expect(calculateItemTotalCents(300_000, 10)).toBe(3);
    expect(calculateItemTotalCents(1_000_000, 10)).toBe(10);
  });

  it('accepts a quantity as bigint', () => {
    expect(calculateItemTotalCents(1_500_000n, 3_000)).toBe(4_500);
  });

  it('accepts a total at the upper range boundary', () => {
    expect(calculateItemTotalCents(1_000_000, MONEY_MAX_CENTS)).toBe(
      MONEY_MAX_CENTS,
    );
  });

  it('rejects a total outside the persistence range', () => {
    expect(() => calculateItemTotalCents(2_000_000, MONEY_MAX_CENTS)).toThrow(
      RangeError,
    );
  });

  it('rejects non-integer quantity and unit price', () => {
    expect(() => calculateItemTotalCents(1.5, 100)).toThrow(RangeError);
    expect(() => calculateItemTotalCents(1_000_000, 10.5)).toThrow(RangeError);
  });
});

describe('divideHalfUp', () => {
  it('rounds ties away from zero', () => {
    expect(divideHalfUp(5n, 2n)).toBe(3n);
    expect(divideHalfUp(-5n, 2n)).toBe(-3n);
    expect(divideHalfUp(4n, 2n)).toBe(2n);
    expect(divideHalfUp(1n, 3n)).toBe(0n);
  });

  it('rejects a non-positive denominator', () => {
    expect(() => divideHalfUp(1n, 0n)).toThrow(RangeError);
    expect(() => divideHalfUp(1n, -1n)).toThrow(RangeError);
  });
});
