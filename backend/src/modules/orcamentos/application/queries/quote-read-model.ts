import type { QuoteStatus } from '../../domain/entities/quote.js';
import type { DiscountType } from '../../domain/value-objects/discount.js';

// Read model for the quote detail projection (D113/D116/D93). It exposes only
// application data, never domain entities, and keeps dates as Date so the
// Presentation layer serializes them as ISO 8601.

export interface FinancialItemView {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  unitPriceCents: number | null;
  totalCents: number | null;
}

export interface CurtainView {
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
  components: FinancialItemView[];
  totalCents: number;
}

export interface InstallationAddressView {
  postalCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

export interface DiscountView {
  type: DiscountType;
  percentage: number | null;
  fixedAmountCents: number | null;
}

// D93 names. The adjustment is exposed as its effective value (zero when the
// canonical field is null, per D92).
export interface QuoteTotalsView {
  curtainsSubtotalCents: number;
  generalAddOnsSubtotalCents: number;
  subtotalCents: number;
  discountValueCents: number;
  calculatedTotalCents: number;
  commercialAdjustmentCents: number;
  totalCents: number;
}

export interface QuoteDetailView {
  id: string;
  quoteNumber: string;
  customerId: string;
  status: QuoteStatus;
  notes: string | null;
  discount: DiscountView;
  commercialAdjustmentCents: number | null;
  installationAddress: InstallationAddressView | null;
  curtains: CurtainView[];
  generalAddOns: FinancialItemView[];
  totals: QuoteTotalsView;
  createdAt: Date;
  updatedAt: Date;
  firstSentAt: Date | null;
  validUntil: Date | null;
  confirmedAt: Date | null;
  productionStartedAt: Date | null;
  scheduledInstallationAt: Date | null;
  completedAt: Date | null;
  expired: boolean;
  lateInstallation: boolean;
}
