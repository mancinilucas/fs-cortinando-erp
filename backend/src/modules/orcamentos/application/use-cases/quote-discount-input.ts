import { Discount, DiscountType } from '../../domain/value-objects/discount.js';

// Discount payload shared by quote creation and editing (D79/D117). The
// discriminated union mirrors the persistence contract: only the field that
// belongs to the chosen type is accepted.
export type QuoteDiscountInput =
  | {
      type: DiscountType.NO_DISCOUNT;
      percentage?: null;
      fixedAmountCents?: null;
    }
  | {
      type: DiscountType.PERCENTAGE;
      percentage: number;
      fixedAmountCents?: null;
    }
  | {
      type: DiscountType.FIXED_AMOUNT;
      percentage?: null;
      fixedAmountCents: number;
    };

export function toDiscount(
  input: QuoteDiscountInput | null | undefined,
): Discount {
  if (input === null || input === undefined) {
    return Discount.noDiscount();
  }

  switch (input.type) {
    case DiscountType.NO_DISCOUNT:
      return Discount.noDiscount();
    case DiscountType.PERCENTAGE:
      return Discount.percentage(input.percentage);
    case DiscountType.FIXED_AMOUNT:
      return Discount.fixedAmount(input.fixedAmountCents);
  }
}
