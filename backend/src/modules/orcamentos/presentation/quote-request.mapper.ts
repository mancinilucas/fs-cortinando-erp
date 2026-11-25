import type {
  CreatableCurtainInput,
  CreatableFinancialItemInput,
  CreateQuoteFromCustomerInput,
} from '../application/use-cases/create-quote-from-customer.use-case.js';
import type { FinancialItemPatch } from '../domain/entities/financial-item.js';
import type { QuoteCurtainPatch } from '../domain/entities/quote.js';
import { DiscountType } from '../domain/value-objects/discount.js';
import type { QuoteDiscountInput } from '../application/use-cases/quote-discount-input.js';
import type { UpdateQuoteInput } from '../application/use-cases/update-quote.use-case.js';
import type { CreateQuoteDto } from './dto/create-quote.dto.js';
import type { CreateQuoteCurtainDto, UpdateQuoteCurtainDto } from './dto/quote-curtain.dto.js';
import type { QuoteDiscountDto } from './dto/quote-discount.dto.js';
import type {
  QuoteFinancialItemInputDto,
  QuoteFinancialItemUpdateDto,
} from './dto/quote-financial-item.dto.js';
import type { UpdateQuoteDto } from './dto/update-quote.dto.js';

// Converts validated DTOs to application inputs (D116/D117). The only
// non-structural conversion is the discount discriminated union; omitted
// fields stay undefined on update so the patch remains partial. The financial
// composition is one collection in both directions.
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
      curtains: dto.curtains?.map(creatableCurtainOf),
      financialItems: dto.financialItems?.map(creatableItemOf),
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

    if (dto.financialItems !== undefined) {
      input.financialItems = dto.financialItems.map(financialItemPatchOf);
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

function creatableCurtainOf(
  curtain: CreateQuoteCurtainDto,
): CreatableCurtainInput {
  return {
    clientRef: curtain.clientRef,
    room: curtain.room,
    description: curtain.description,
    material: curtain.material,
    openingWidth: curtain.openingWidth,
    borderValue: curtain.borderValue,
    height: curtain.height,
    fabricFactor: curtain.fabricFactor,
    notes: curtain.notes,
  };
}

function creatableItemOf(
  item: QuoteFinancialItemInputDto,
): CreatableFinancialItemInput {
  return {
    name: item.name,
    curtainRef: item.curtainRef,
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
    curtainId: item.curtainId,
    curtainRef: item.curtainRef,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    unitPriceCents: item.unitPriceCents,
  };
}

function curtainPatchOf(curtain: UpdateQuoteCurtainDto): QuoteCurtainPatch {
  return {
    id: curtain.id,
    clientRef: curtain.clientRef,
    room: curtain.room,
    description: curtain.description,
    material: curtain.material,
    openingWidth: curtain.openingWidth,
    borderValue: curtain.borderValue,
    height: curtain.height,
    fabricFactor: curtain.fabricFactor,
    notes: curtain.notes,
  };
}
