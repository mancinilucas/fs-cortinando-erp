import { Injectable } from '@nestjs/common';
import type { Curtain } from '../../domain/entities/curtain.js';
import type { FinancialItem } from '../../domain/entities/financial-item.js';
import type { Quote } from '../../domain/entities/quote.js';
import { QuoteRepository } from '../../domain/repositories/quote.repository.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { Clock } from '../ports/clock.port.js';
import type {
  CurtainView,
  FinancialItemView,
  QuoteDetailView,
} from './quote-read-model.js';

export interface GetQuoteInput {
  id: string;
}

/**
 * Detail projection (D113). The aggregate is loaded to derive values, but the
 * response is a read model and never exposes domain entities.
 */
@Injectable()
export class GetQuoteQuery {
  constructor(
    private readonly quotes: QuoteRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: GetQuoteInput): Promise<QuoteDetailView> {
    const quote = await this.quotes.findById(input.id);

    if (quote === null) {
      throw new QuoteNotFoundError();
    }

    return toQuoteDetail(quote, this.clock.now());
  }
}

export function toQuoteDetail(quote: Quote, now: Date): QuoteDetailView {
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber.value,
    customerId: quote.customerId,
    status: quote.status,
    notes: quote.notes,
    discount: {
      type: quote.discount.type,
      percentage: quote.discount.percentage,
      fixedAmountCents: quote.discount.fixedAmountCents,
    },
    commercialAdjustmentCents: quote.commercialAdjustmentCents,
    installationAddress:
      quote.installationAddress === null
        ? null
        : {
            postalCode: quote.installationAddress.postalCode,
            street: quote.installationAddress.street,
            number: quote.installationAddress.number,
            complement: quote.installationAddress.complement,
            neighborhood: quote.installationAddress.neighborhood,
            city: quote.installationAddress.city,
            state: quote.installationAddress.state,
          },
    curtains: quote.curtains.map(toCurtainView),
    generalAddOns: quote.generalAddOns.map(toFinancialItemView),
    totals: {
      curtainsSubtotalCents: quote.curtainsSubtotalCents,
      generalAddOnsSubtotalCents: quote.generalAddOnsSubtotalCents,
      subtotalCents: quote.subtotalCents,
      discountValueCents: quote.discountValueCents,
      calculatedTotalCents: quote.calculatedTotalCents,
      commercialAdjustmentCents: quote.effectiveCommercialAdjustmentCents,
      totalCents: quote.totalCents,
    },
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
    firstSentAt: quote.firstSentAt,
    validUntil: quote.validUntil,
    confirmedAt: quote.confirmedAt,
    productionStartedAt: quote.productionStartedAt,
    scheduledInstallationAt: quote.scheduledInstallationAt,
    completedAt: quote.completedAt,
    expired: quote.isExpired(now),
    lateInstallation: quote.isLateInstallation(now),
  };
}

function toCurtainView(curtain: Curtain): CurtainView {
  return {
    id: curtain.id,
    sequence: curtain.sequence,
    room: curtain.room,
    description: curtain.description,
    material: curtain.material,
    openingWidth: curtain.openingWidth,
    borderValue: curtain.borderValue,
    finalWidth: curtain.finalWidth,
    height: curtain.height,
    fabricFactor: curtain.fabricFactor,
    fabricQuantity: curtain.fabricQuantity,
    notes: curtain.notes,
    components: curtain.components.map(toFinancialItemView),
    totalCents: curtain.financialTotalCents,
  };
}

function toFinancialItemView(item: FinancialItem): FinancialItemView {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    unitPriceCents: item.unitPriceCents,
    totalCents: item.totalCents,
  };
}
