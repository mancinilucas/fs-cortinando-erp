import { divideHalfUp } from './money.js';

// Global quote discount Value Object (D90/D91). Percentage is stored as
// hundredths of a percent (12.34% -> 1234) so that the monetary value can be
// computed with exact integer arithmetic and HALF_UP rounding.

export enum DiscountType {
  NO_DISCOUNT = 'NO_DISCOUNT',
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
}

const PERCENTAGE_SCALE = 100;
const PERCENTAGE_DENOMINATOR = 10_000n;
const SCALE_EPSILON = 1e-6;

export class Discount {
  private constructor(
    readonly type: DiscountType,
    readonly percentageHundredths: number | null,
    readonly fixedAmountCents: number | null,
  ) {}

  static noDiscount(): Discount {
    return new Discount(DiscountType.NO_DISCOUNT, null, null);
  }

  static percentage(percentage: number): Discount {
    if (!Number.isFinite(percentage)) {
      throw new RangeError('Discount percentage must be a finite number');
    }

    const scaled = percentage * PERCENTAGE_SCALE;
    const hundredths = Math.round(scaled);

    if (Math.abs(scaled - hundredths) >= SCALE_EPSILON) {
      throw new RangeError(
        'Discount percentage must have at most two decimal places',
      );
    }

    if (hundredths <= 0 || hundredths > 100 * PERCENTAGE_SCALE) {
      throw new RangeError(
        'Discount percentage must be greater than 0 and at most 100',
      );
    }

    return new Discount(DiscountType.PERCENTAGE, hundredths, null);
  }

  static fixedAmount(cents: number): Discount {
    if (!Number.isSafeInteger(cents)) {
      throw new RangeError('Fixed discount must be an integer amount in cents');
    }

    if (cents <= 0) {
      throw new RangeError('Fixed discount must be greater than zero');
    }

    return new Discount(DiscountType.FIXED_AMOUNT, null, cents);
  }

  static fromPersistence(input: {
    type: DiscountType;
    percentage: number | null;
    fixedAmountCents: number | null;
  }): Discount {
    switch (input.type) {
      case DiscountType.NO_DISCOUNT:
        if (input.percentage !== null || input.fixedAmountCents !== null) {
          throw new RangeError(
            'No-discount type cannot carry percentage or fixed amount',
          );
        }

        return Discount.noDiscount();
      case DiscountType.PERCENTAGE:
        if (input.percentage === null || input.fixedAmountCents !== null) {
          throw new RangeError(
            'Percentage discount requires only a percentage',
          );
        }

        return Discount.percentage(input.percentage);
      case DiscountType.FIXED_AMOUNT:
        if (input.fixedAmountCents === null || input.percentage !== null) {
          throw new RangeError('Fixed discount requires only a fixed amount');
        }

        return Discount.fixedAmount(input.fixedAmountCents);
      default:
        throw new RangeError('Unknown discount type');
    }
  }

  get percentage(): number | null {
    return this.percentageHundredths === null
      ? null
      : this.percentageHundredths / PERCENTAGE_SCALE;
  }

  calculateValueCents(subtotalCents: number): number {
    if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0) {
      throw new RangeError('Subtotal must be a non-negative integer');
    }

    switch (this.type) {
      case DiscountType.NO_DISCOUNT:
        return 0;
      case DiscountType.PERCENTAGE:
        return Number(
          divideHalfUp(
            BigInt(subtotalCents) * BigInt(this.percentageHundredths ?? 0),
            PERCENTAGE_DENOMINATOR,
          ),
        );
      case DiscountType.FIXED_AMOUNT:
        return this.fixedAmountCents ?? 0;
    }
  }

  isApplicableTo(subtotalCents: number): boolean {
    if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0) {
      throw new RangeError('Subtotal must be a non-negative integer');
    }

    return (
      this.type !== DiscountType.FIXED_AMOUNT ||
      (this.fixedAmountCents ?? 0) <= subtotalCents
    );
  }

  equals(other: Discount): boolean {
    return (
      this.type === other.type &&
      this.percentageHundredths === other.percentageHundredths &&
      this.fixedAmountCents === other.fixedAmountCents
    );
  }
}
