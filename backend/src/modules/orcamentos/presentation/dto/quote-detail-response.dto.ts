import type { QuoteStatus } from '../../domain/entities/quote.js';
import type { DiscountType } from '../../domain/value-objects/discount.js';
import type { QuoteInstallationAddressDto } from './quote-installation-address.dto.js';

// Public quote detail response (D93/D113/D116). Dates are serialized as ISO
// 8601 strings and derived values are read-only fields of the response.
export class QuoteFinancialItemResponseDto {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  unitPriceCents: number | null;
  totalCents: number | null;
}

export class QuoteCurtainResponseDto {
  id: string;
  sequence: number;
  room: string | null;
  description: string | null;
  material: string | null;
  openingWidth: number | null;
  borderValue: number | null;
  finalWidth: number | null;
  height: number | null;
  fabricFactor: number | null;
  fabricQuantity: number | null;
  notes: string | null;
  components: QuoteFinancialItemResponseDto[];
  totalCents: number;
}

export class QuoteDiscountResponseDto {
  type: DiscountType;
  percentage: number | null;
  fixedAmountCents: number | null;
}

export class QuoteTotalsResponseDto {
  curtainsSubtotalCents: number;
  generalAddOnsSubtotalCents: number;
  subtotalCents: number;
  discountValueCents: number;
  calculatedTotalCents: number;
  commercialAdjustmentCents: number;
  totalCents: number;
}

export class QuoteDetailResponseDto {
  id: string;
  quoteNumber: string;
  customerId: string;
  status: QuoteStatus;
  notes: string | null;
  discount: QuoteDiscountResponseDto;
  commercialAdjustmentCents: number | null;
  installationAddress: QuoteInstallationAddressDto | null;
  curtains: QuoteCurtainResponseDto[];
  generalAddOns: QuoteFinancialItemResponseDto[];
  totals: QuoteTotalsResponseDto;
  createdAt: string;
  updatedAt: string;
  firstSentAt: string | null;
  validUntil: string | null;
  confirmedAt: string | null;
  productionStartedAt: string | null;
  scheduledInstallationAt: string | null;
  completedAt: string | null;
  expired: boolean;
  lateInstallation: boolean;
}
