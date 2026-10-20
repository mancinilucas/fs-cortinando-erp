import type { QuoteHistoryEntry } from '../application/ports/quote-history-query.repository.js';
import type { QuoteSummaryView } from '../application/ports/quote-search-query.repository.js';
import type {
  CurtainView,
  FinancialItemView,
  QuoteDetailView,
} from '../application/queries/quote-read-model.js';
import type {
  QuoteCurtainResponseDto,
  QuoteDetailResponseDto,
  QuoteFinancialItemResponseDto,
  QuoteTotalsResponseDto,
} from './dto/quote-detail-response.dto.js';
import type { QuoteHistoryResponseDto } from './dto/quote-history-response.dto.js';
import type { QuoteSummaryResponseDto } from './dto/quote-summary-response.dto.js';

// Translates application read models to the public JSON contract (D113/D116).
// Dates become ISO 8601 strings; domain entities never reach the response.
export class QuoteResponseMapper {
  static toDetail(view: QuoteDetailView): QuoteDetailResponseDto {
    return {
      id: view.id,
      quoteNumber: view.quoteNumber,
      customerId: view.customerId,
      status: view.status,
      notes: view.notes,
      discount: {
        type: view.discount.type,
        percentage: view.discount.percentage,
        fixedAmountCents: view.discount.fixedAmountCents,
      },
      commercialAdjustmentCents: view.commercialAdjustmentCents,
      installationAddress:
        view.installationAddress === null
          ? null
          : {
              postalCode: view.installationAddress.postalCode,
              street: view.installationAddress.street,
              number: view.installationAddress.number,
              complement: view.installationAddress.complement,
              neighborhood: view.installationAddress.neighborhood,
              city: view.installationAddress.city,
              state: view.installationAddress.state,
            },
      curtains: view.curtains.map(toCurtain),
      generalAddOns: view.generalAddOns.map(toFinancialItem),
      totals: toTotals(view.totals),
      createdAt: view.createdAt.toISOString(),
      updatedAt: view.updatedAt.toISOString(),
      firstSentAt: isoOrNull(view.firstSentAt),
      validUntil: isoOrNull(view.validUntil),
      confirmedAt: isoOrNull(view.confirmedAt),
      productionStartedAt: isoOrNull(view.productionStartedAt),
      scheduledInstallationAt: isoOrNull(view.scheduledInstallationAt),
      completedAt: isoOrNull(view.completedAt),
      expired: view.expired,
      lateInstallation: view.lateInstallation,
    };
  }

  static toSummary(view: QuoteSummaryView): QuoteSummaryResponseDto {
    return {
      id: view.id,
      quoteNumber: view.quoteNumber,
      customer: { id: view.customer.id, name: view.customer.name },
      status: view.status,
      expired: view.expired,
      totalCents: view.totalCents,
      createdAt: view.createdAt.toISOString(),
      validUntil: isoOrNull(view.validUntil),
      scheduledInstallationAt: isoOrNull(view.scheduledInstallationAt),
    };
  }

  static toHistory(entry: QuoteHistoryEntry): QuoteHistoryResponseDto {
    return {
      id: entry.id,
      eventType: entry.eventType,
      occurredAt: entry.occurredAt.toISOString(),
      details: entry.details,
    };
  }
}

function toCurtain(curtain: CurtainView): QuoteCurtainResponseDto {
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
    components: curtain.components.map(toFinancialItem),
    totalCents: curtain.totalCents,
  };
}

function toFinancialItem(
  item: FinancialItemView,
): QuoteFinancialItemResponseDto {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    unitPriceCents: item.unitPriceCents,
    totalCents: item.totalCents,
  };
}

function toTotals(totals: QuoteDetailView['totals']): QuoteTotalsResponseDto {
  return {
    curtainsSubtotalCents: totals.curtainsSubtotalCents,
    generalAddOnsSubtotalCents: totals.generalAddOnsSubtotalCents,
    subtotalCents: totals.subtotalCents,
    discountValueCents: totals.discountValueCents,
    calculatedTotalCents: totals.calculatedTotalCents,
    commercialAdjustmentCents: totals.commercialAdjustmentCents,
    totalCents: totals.totalCents,
  };
}

function isoOrNull(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}
