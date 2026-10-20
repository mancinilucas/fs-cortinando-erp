import { describe, expect, it } from 'vitest';
import { Discount, DiscountType } from './discount.js';

describe('Discount', () => {
  it('creates a no-discount value', () => {
    const discount = Discount.noDiscount();

    expect(discount.type).toBe(DiscountType.NO_DISCOUNT);
    expect(discount.percentage).toBeNull();
    expect(discount.fixedAmountCents).toBeNull();
    expect(discount.calculateValueCents(10_000)).toBe(0);
  });

  it('creates a percentage discount and exposes it as a number', () => {
    const discount = Discount.percentage(12.34);

    expect(discount.type).toBe(DiscountType.PERCENTAGE);
    expect(discount.percentage).toBe(12.34);
    expect(discount.percentageHundredths).toBe(1234);
    expect(discount.fixedAmountCents).toBeNull();
  });

  it('calculates 10% exactly', () => {
    expect(Discount.percentage(10).calculateValueCents(10_000)).toBe(1_000);
  });

  it('calculates 12.34% exactly', () => {
    expect(Discount.percentage(12.34).calculateValueCents(10_000)).toBe(1_234);
  });

  it('calculates a percentage of a large subtotal without float drift', () => {
    expect(Discount.percentage(12.34).calculateValueCents(123_456_789)).toBe(
      15_234_568,
    );
  });

  it('allows 100%', () => {
    const discount = Discount.percentage(100);

    expect(discount.calculateValueCents(10_000)).toBe(10_000);
  });

  it('rounds percentage values HALF_UP', () => {
    // 4 * 12.5% = 0.5 cent -> 1
    expect(Discount.percentage(12.5).calculateValueCents(4)).toBe(1);
    // 3 * 50% = 1.5 cents -> 2
    expect(Discount.percentage(50).calculateValueCents(3)).toBe(2);
    // 5 * 10% = 0.5 cent -> 1
    expect(Discount.percentage(10).calculateValueCents(5)).toBe(1);
    // 4 * 10% = 0.4 cent -> 0
    expect(Discount.percentage(10).calculateValueCents(4)).toBe(0);
  });

  it('creates and applies a fixed amount discount', () => {
    const discount = Discount.fixedAmount(1_500);

    expect(discount.type).toBe(DiscountType.FIXED_AMOUNT);
    expect(discount.percentage).toBeNull();
    expect(discount.fixedAmountCents).toBe(1_500);
    expect(discount.calculateValueCents(10_000)).toBe(1_500);
  });

  it('rejects invalid percentages', () => {
    for (const percentage of [
      0,
      -1,
      100.01,
      12.345,
      0.001,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(() => Discount.percentage(percentage)).toThrow(RangeError);
    }
  });

  it('rejects invalid fixed amounts', () => {
    for (const cents of [0, -1, 10.5, Number.NaN]) {
      expect(() => Discount.fixedAmount(cents)).toThrow(RangeError);
    }
  });

  it('restores valid persisted combinations', () => {
    expect(
      Discount.fromPersistence({
        type: DiscountType.NO_DISCOUNT,
        percentage: null,
        fixedAmountCents: null,
      }).equals(Discount.noDiscount()),
    ).toBe(true);

    expect(
      Discount.fromPersistence({
        type: DiscountType.PERCENTAGE,
        percentage: 12.34,
        fixedAmountCents: null,
      }).equals(Discount.percentage(12.34)),
    ).toBe(true);

    expect(
      Discount.fromPersistence({
        type: DiscountType.FIXED_AMOUNT,
        percentage: null,
        fixedAmountCents: 500,
      }).equals(Discount.fixedAmount(500)),
    ).toBe(true);
  });

  it('rejects inconsistent persisted combinations', () => {
    const invalid = [
      {
        type: DiscountType.NO_DISCOUNT,
        percentage: 10,
        fixedAmountCents: null,
      },
      {
        type: DiscountType.NO_DISCOUNT,
        percentage: null,
        fixedAmountCents: 500,
      },
      {
        type: DiscountType.PERCENTAGE,
        percentage: null,
        fixedAmountCents: null,
      },
      {
        type: DiscountType.PERCENTAGE,
        percentage: 10,
        fixedAmountCents: 500,
      },
      {
        type: DiscountType.FIXED_AMOUNT,
        percentage: null,
        fixedAmountCents: null,
      },
      {
        type: DiscountType.FIXED_AMOUNT,
        percentage: 10,
        fixedAmountCents: 500,
      },
      {
        type: 'UNKNOWN' as DiscountType,
        percentage: null,
        fixedAmountCents: null,
      },
    ];

    for (const input of invalid) {
      expect(() => Discount.fromPersistence(input)).toThrow(RangeError);
    }
  });

  it('validates a fixed discount against the known subtotal', () => {
    const discount = Discount.fixedAmount(500);

    expect(discount.isApplicableTo(500)).toBe(true);
    expect(discount.isApplicableTo(501)).toBe(true);
    expect(discount.isApplicableTo(499)).toBe(false);
    expect(Discount.percentage(100).isApplicableTo(0)).toBe(true);
    expect(Discount.noDiscount().isApplicableTo(0)).toBe(true);
  });

  it('rejects invalid subtotals', () => {
    const discount = Discount.percentage(10);

    expect(() => discount.calculateValueCents(-1)).toThrow(RangeError);
    expect(() => discount.calculateValueCents(1.5)).toThrow(RangeError);
    expect(() => discount.isApplicableTo(-1)).toThrow(RangeError);
  });

  it('compares discounts by value', () => {
    expect(Discount.percentage(10).equals(Discount.percentage(10))).toBe(true);
    expect(Discount.percentage(10).equals(Discount.percentage(11))).toBe(false);
    expect(Discount.fixedAmount(10).equals(Discount.fixedAmount(10))).toBe(
      true,
    );
    expect(Discount.noDiscount().equals(Discount.percentage(10))).toBe(false);
  });
});
