import { Curtain } from '../../domain/entities/curtain.js';
import { FinancialItem } from '../../domain/entities/financial-item.js';
import { Quote, QuoteStatus } from '../../domain/entities/quote.js';
import { Discount, DiscountType } from '../../domain/value-objects/discount.js';
import { InstallationAddress } from '../../domain/value-objects/installation-address.js';
import { QuoteNumber } from '../../domain/value-objects/quote-number.js';

// Persistence mapper for the Quote aggregate (D112). Record types are
// structural so the mapper does not depend on generated Prisma types; Decimal
// columns are accepted as anything that can be stringified.

export interface NumericValue {
  toString(): string;
}

export type NumericColumn = number | string | NumericValue;

export interface QuoteRecord {
  id: string;
  quoteNumber: string;
  customerId: string;
  status: string;
  notes: string | null;
  discountType: string;
  discountPercentage: NumericColumn | null;
  discountFixedAmountCents: number | null;
  commercialAdjustmentCents: number | null;
  installationAddressPostalCode: string | null;
  installationAddressStreet: string | null;
  installationAddressNumber: string | null;
  installationAddressComplement: string | null;
  installationAddressNeighborhood: string | null;
  installationAddressCity: string | null;
  installationAddressState: string | null;
  createdAt: Date;
  updatedAt: Date;
  firstSentAt: Date | null;
  validUntil: Date | null;
  confirmedAt: Date | null;
  productionStartedAt: Date | null;
  scheduledInstallationAt: Date | null;
  completedAt: Date | null;
  curtains: CurtainRecord[];
  generalAddOns: FinancialItemRecord[];
}

export interface CurtainRecord {
  id: string;
  sequence: number;
  room: string | null;
  description: string | null;
  material: string | null;
  openingWidth: NumericColumn | null;
  borderValue: NumericColumn | null;
  height: NumericColumn | null;
  fabricFactor: NumericColumn | null;
  notes: string | null;
  components: FinancialItemRecord[];
}

export interface FinancialItemRecord {
  id: string;
  name: string;
  quantity: NumericColumn | null;
  unit: string | null;
  unitPriceCents: number | null;
}

export interface QuotePersistenceData {
  quoteNumber: string;
  customerId: string;
  status: QuoteStatus;
  notes: string | null;
  discountType: DiscountType;
  discountPercentage: number | null;
  discountFixedAmountCents: number | null;
  commercialAdjustmentCents: number | null;
  installationAddressPostalCode: string | null;
  installationAddressStreet: string | null;
  installationAddressNumber: string | null;
  installationAddressComplement: string | null;
  installationAddressNeighborhood: string | null;
  installationAddressCity: string | null;
  installationAddressState: string | null;
  createdAt: Date;
  updatedAt: Date;
  firstSentAt: Date | null;
  validUntil: Date | null;
  confirmedAt: Date | null;
  productionStartedAt: Date | null;
  scheduledInstallationAt: Date | null;
  completedAt: Date | null;
}

export interface CurtainPersistenceData {
  id: string;
  sequence: number;
  room: string | null;
  description: string | null;
  material: string | null;
  openingWidth: number | null;
  borderValue: number | null;
  height: number | null;
  fabricFactor: number | null;
  notes: string | null;
}

export interface FinancialItemPersistenceData {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  unitPriceCents: number | null;
}

export class QuoteMapper {
  static toDomain(record: QuoteRecord): Quote {
    return Quote.rehydrate({
      id: record.id,
      quoteNumber: QuoteNumber.parse(record.quoteNumber),
      customerId: record.customerId,
      status: toQuoteStatus(record.status),
      installationAddress: toInstallationAddress(record),
      curtains: record.curtains.map(toCurtain),
      generalAddOns: record.generalAddOns.map(toFinancialItem),
      discount: Discount.fromPersistence({
        type: toDiscountType(record.discountType),
        percentage: toNumber(record.discountPercentage),
        fixedAmountCents: record.discountFixedAmountCents,
      }),
      commercialAdjustmentCents: record.commercialAdjustmentCents,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      firstSentAt: record.firstSentAt,
      validUntil: record.validUntil,
      confirmedAt: record.confirmedAt,
      productionStartedAt: record.productionStartedAt,
      scheduledInstallationAt: record.scheduledInstallationAt,
      completedAt: record.completedAt,
    });
  }

  static toPersistence(quote: Quote): QuotePersistenceData {
    return {
      quoteNumber: quote.quoteNumber.value,
      customerId: quote.customerId,
      status: quote.status,
      notes: quote.notes,
      discountType: quote.discount.type,
      discountPercentage: quote.discount.percentage,
      discountFixedAmountCents: quote.discount.fixedAmountCents,
      commercialAdjustmentCents: quote.commercialAdjustmentCents,
      installationAddressPostalCode:
        quote.installationAddress?.postalCode ?? null,
      installationAddressStreet: quote.installationAddress?.street ?? null,
      installationAddressNumber: quote.installationAddress?.number ?? null,
      installationAddressComplement:
        quote.installationAddress?.complement ?? null,
      installationAddressNeighborhood:
        quote.installationAddress?.neighborhood ?? null,
      installationAddressCity: quote.installationAddress?.city ?? null,
      installationAddressState: quote.installationAddress?.state ?? null,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
      firstSentAt: quote.firstSentAt,
      validUntil: quote.validUntil,
      confirmedAt: quote.confirmedAt,
      productionStartedAt: quote.productionStartedAt,
      scheduledInstallationAt: quote.scheduledInstallationAt,
      completedAt: quote.completedAt,
    };
  }

  static curtainToPersistence(curtain: Curtain): CurtainPersistenceData {
    return {
      id: curtain.id,
      sequence: curtain.sequence,
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

  static financialItemToPersistence(
    item: FinancialItem,
  ): FinancialItemPersistenceData {
    return {
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      unitPriceCents: item.unitPriceCents,
    };
  }
}

function toCurtain(record: CurtainRecord): Curtain {
  return Curtain.rehydrate({
    id: record.id,
    sequence: record.sequence,
    room: record.room,
    description: record.description,
    material: record.material,
    openingWidth: toNumber(record.openingWidth),
    borderValue: toNumber(record.borderValue),
    height: toNumber(record.height),
    fabricFactor: toNumber(record.fabricFactor),
    notes: record.notes,
    components: record.components.map(toFinancialItem),
  });
}

function toFinancialItem(record: FinancialItemRecord): FinancialItem {
  return FinancialItem.rehydrate({
    id: record.id,
    name: record.name,
    quantity: toNumber(record.quantity),
    unit: record.unit,
    unitPriceCents: record.unitPriceCents,
  });
}

function toInstallationAddress(
  record: QuoteRecord,
): InstallationAddress | null {
  const input = {
    postalCode: record.installationAddressPostalCode,
    street: record.installationAddressStreet,
    number: record.installationAddressNumber,
    complement: record.installationAddressComplement,
    neighborhood: record.installationAddressNeighborhood,
    city: record.installationAddressCity,
    state: record.installationAddressState,
  };

  const hasAnyValue = Object.values(input).some((value) => value !== null);

  return hasAnyValue ? InstallationAddress.create(input) : null;
}

function toNumber(value: NumericColumn | null): number | null {
  return value === null ? null : Number(value.toString());
}

function toQuoteStatus(value: string): QuoteStatus {
  if (!isQuoteStatus(value)) {
    throw new RangeError(`Unknown quote status: ${value}`);
  }

  return value;
}

function isQuoteStatus(value: string): value is QuoteStatus {
  return Object.values(QuoteStatus).some((status) => status === value);
}

function toDiscountType(value: string): DiscountType {
  if (!isDiscountType(value)) {
    throw new RangeError(`Unknown discount type: ${value}`);
  }

  return value;
}

function isDiscountType(value: string): value is DiscountType {
  return Object.values(DiscountType).some((type) => type === value);
}
