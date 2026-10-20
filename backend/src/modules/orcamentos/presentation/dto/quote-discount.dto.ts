import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  Validate,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { DiscountType } from '../../domain/value-objects/discount.js';

// D90: each discount type admits only its own value field, and the other one
// stays null. The constraint runs on `type`, but inspects the whole DTO.
@ValidatorConstraint({ name: 'discountCombination' })
class DiscountCombinationConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as QuoteDiscountDto;

    switch (dto.type) {
      case DiscountType.NO_DISCOUNT:
        return dto.percentage == null && dto.fixedAmountCents == null;
      case DiscountType.PERCENTAGE:
        return dto.percentage != null && dto.fixedAmountCents == null;
      case DiscountType.FIXED_AMOUNT:
        return dto.fixedAmountCents != null && dto.percentage == null;
      default:
        return false;
    }
  }

  defaultMessage(): string {
    return 'discount must provide exactly the value required by its type';
  }
}

// Global discount accepted by create and update (D90/D116).
export class QuoteDiscountDto {
  @IsEnum(DiscountType)
  @Validate(DiscountCombinationConstraint)
  type: DiscountType;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(100)
  percentage?: number | null;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(2_147_483_647)
  fixedAmountCents?: number | null;
}
