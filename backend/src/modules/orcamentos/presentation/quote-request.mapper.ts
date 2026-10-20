import type {
  FinancialItemInput,
  FinancialItemPatch,
} from '../domain/entities/financial-item.js';
import type { QuoteCurtainPatch } from '../domain/entities/quote.js';
import { DiscountType } from '../domain/value-objects/discount.js';
import type { CreateQuoteFromCustomerInput } from '../application/use-cases/create-quote-from-customer.use-case.js';
import type { QuoteDiscountInput } from '../application/use-cases/quote-discount-input.js';
import type { UpdateQuoteInput } from '../application/use-cases/update-quote.use-case.js';
import type { CreateQuoteDto } from './dto/create-quote.dto.js';
import type { UpdateQuoteCurtainDto } from './dto/quote-curtain.dto.js';
import type { QuoteDiscountDto } from './dto/quote-discount.dto.js';
import type {
  QuoteFinancialItemInputDto,
  QuoteFinancialItemUpdateDto,
} from './dto/quote-financial-item.dto.js';
import type { UpdateQuoteDto } from './dto/update-quote.dto.js';

// Converts validated DTOs to application inputs (D116/D117). The only
// non-structural conversion is the discount discriminated union; omitted
// fields stay undefined on update so the patch remains partial.
export class QuoteRequestMapper {
  static toCreateInput(
    customerId: string,
    dto: CreateQuoteDto,
  ): CreateQuoteFromCustomerInput {
    return {
      customerId,
      notes: dto.notes,
      discount: discountOf(dto.discount),
      commercialAdjustmentCents: dto.commercialAdjustmentCents,
      installationAddress: dto.installationAddress,
      curtains: dto.curtains?.map((curtain) => ({
        room: curtain.room,
        description: curtain.description,
        material: curtain.material,
        openingWidth: curtain.openingWidth,
        borderValue: curtain.borderValue,
        height: curtain.height,
        fabricFactor: curtain.fabricFactor,
        notes: curtain.notes,
        components: curtain.components?.map(financialItemOf),
      })),
      generalAddOns: dto.generalAddOns?.map(financialItemOf),
    };
  }

  static toUpdateInput(id: string, dto: UpdateQuoteDto): UpdateQuoteInput {
    const input: UpdateQuoteInput = { id };

    if (dto.notes !== undefined) {
      input.notes = dto.notes;
    }

    if (dto.discount !== undefined) {
      input.discount = discountOf(dto.discount);
    }

    if (dto.commercialAdjustmentCents !== undefined) {
      input.commercialAdjustmentCents = dto.commercialAdjustmentCents;
    }

    if (dto.installationAddress !== undefined) {
      input.installationAddress = dto.installationAddress;
    }

    if (dto.curtains !== undefined) {
      input.curtains = dto.curtains.map(curtainPatchOf);
    }

    if (dto.generalAddOns !== undefined) {
      input.generalAddOns = dto.generalAddOns.map(financialItemPatchOf);
    }

    return input;
  }
}

function discountOf(
  discount: QuoteDiscountDto | null | undefined,
): QuoteDiscountInput | null | undefined {
  if (discount === null || discount === undefined) {
    return discount;
  }

  switch (discount.type) {
    case DiscountType.NO_DISCOUNT:
      return { type: DiscountType.NO_DISCOUNT };
    case DiscountType.PERCENTAGE:
      if (discount.percentage == null) {
        throw new Error('PERCENTAGE discount requires percentage');
      }

      return { type: DiscountType.PERCENTAGE, percentage: discount.percentage };
    case DiscountType.FIXED_AMOUNT:
      if (discount.fixedAmountCents == null) {
        throw new Error('FIXED_AMOUNT discount requires fixedAmountCents');
      }

      return {
        type: DiscountType.FIXED_AMOUNT,
        fixedAmountCents: discount.fixedAmountCents,
      };
  }
}

function financialItemOf(item: QuoteFinancialItemInputDto): FinancialItemInput {
  return {
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    unitPriceCents: item.unitPriceCents,
  };
}

function financialItemPatchOf(
  item: QuoteFinancialItemUpdateDto,
): FinancialItemPatch {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    unitPriceCents: item.unitPriceCents,
  };
}

function curtainPatchOf(curtain: UpdateQuoteCurtainDto): QuoteCurtainPatch {
  return {
    id: curtain.id,
    room: curtain.room,
    description: curtain.description,
    material: curtain.material,
    openingWidth: curtain.openingWidth,
    borderValue: curtain.borderValue,
    height: curtain.height,
    fabricFactor: curtain.fabricFactor,
    notes: curtain.notes,
    components: curtain.components?.map(financialItemPatchOf),
  };
}
