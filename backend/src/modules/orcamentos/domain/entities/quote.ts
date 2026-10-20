import { randomUUID } from 'node:crypto';
import type { Curtain } from './curtain.js';
import type { FinancialItem } from './financial-item.js';
import { Discount } from '../value-objects/discount.js';
import type { InstallationAddress } from '../value-objects/installation-address.js';
import { Money } from '../value-objects/money.js';
import type { QuoteNumber } from '../value-objects/quote-number.js';

// Quote Aggregate Root (D76). It owns the commercial composition and derived
// totals. History is deliberately not loaded with the aggregate; lifecycle
// transitions belong to later domain tasks.

export enum QuoteStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  CONFIRMED = 'CONFIRMED',
  IN_PRODUCTION = 'IN_PRODUCTION',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface CreateQuoteInput {
  quoteNumber: QuoteNumber;
  customerId: string;
  createdAt: Date;
  installationAddress?: InstallationAddress | null;
  curtains?: Curtain[];
  generalAddOns?: FinancialItem[];
  discount?: Discount;
  commercialAdjustmentCents?: number | null;
  notes?: string | null;
}

export interface UpdateQuoteEditableDataInput {
  installationAddress?: InstallationAddress | null;
  discount?: Discount | null;
  commercialAdjustmentCents?: number | null;
  notes?: string | null;
}

export interface QuoteSnapshot {
  id: string;
  quoteNumber: QuoteNumber;
  customerId: string;
  status: QuoteStatus;
  installationAddress: InstallationAddress | null;
  curtains: Curtain[];
  generalAddOns: FinancialItem[];
  discount: Discount;
  commercialAdjustmentCents: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  firstSentAt: Date | null;
  validUntil: Date | null;
  confirmedAt: Date | null;
  productionStartedAt: Date | null;
  scheduledInstallationAt: Date | null;
  completedAt: Date | null;
}

export class Quote {
  private constructor(
    readonly id: string,
    readonly quoteNumber: QuoteNumber,
    readonly customerId: string,
    public status: QuoteStatus,
    public installationAddress: InstallationAddress | null,
    public curtains: Curtain[],
    public generalAddOns: FinancialItem[],
    public discount: Discount,
    public commercialAdjustmentCents: number | null,
    public notes: string | null,
    readonly createdAt: Date,
    public updatedAt: Date,
    public firstSentAt: Date | null,
    public validUntil: Date | null,
    public confirmedAt: Date | null,
    public productionStartedAt: Date | null,
    public scheduledInstallationAt: Date | null,
    public completedAt: Date | null,
  ) {}

  static create(input: CreateQuoteInput): Quote {
    assertValidDate(input.createdAt, 'Quote createdAt');

    const quote = new Quote(
      randomUUID(),
      input.quoteNumber,
      input.customerId,
      QuoteStatus.DRAFT,
      input.installationAddress ?? null,
      [...(input.curtains ?? [])],
      [...(input.generalAddOns ?? [])],
      input.discount ?? Discount.noDiscount(),
      normalizeAdjustment(input.commercialAdjustmentCents),
      normalizeText(input.notes),
      input.createdAt,
      input.createdAt,
      null,
      null,
      null,
      null,
      null,
      null,
    );

    quote.normalizeCurtainSequences();

    return quote;
  }

  static rehydrate(snapshot: QuoteSnapshot): Quote {
    return new Quote(
      snapshot.id,
      snapshot.quoteNumber,
      snapshot.customerId,
      snapshot.status,
      snapshot.installationAddress,
      snapshot.curtains,
      snapshot.generalAddOns,
      snapshot.discount,
      snapshot.commercialAdjustmentCents,
      snapshot.notes,
      snapshot.createdAt,
      snapshot.updatedAt,
      snapshot.firstSentAt,
      snapshot.validUntil,
      snapshot.confirmedAt,
      snapshot.productionStartedAt,
      snapshot.scheduledInstallationAt,
      snapshot.completedAt,
    );
  }

  // Scalar part of D117: an omitted field keeps its value, null clears it
  // where absence is allowed, and a provided value replaces the current one.
  updateEditableData(input: UpdateQuoteEditableDataInput): void {
    if (input.installationAddress !== undefined) {
      this.installationAddress = input.installationAddress;
    }

    if (input.discount !== undefined) {
      this.discount = input.discount ?? Discount.noDiscount();
    }

    if (input.commercialAdjustmentCents !== undefined) {
      this.commercialAdjustmentCents = normalizeAdjustment(
        input.commercialAdjustmentCents,
      );
    }

    if (input.notes !== undefined) {
      this.notes = normalizeText(input.notes);
    }
  }

  normalizeCurtainSequences(): void {
    this.curtains.forEach((curtain, index) => {
      curtain.sequence = index + 1;
    });
  }

  get curtainsSubtotalCents(): number {
    const total = this.curtains.reduce(
      (sum, curtain) => sum.add(Money.fromCents(curtain.financialTotalCents)),
      Money.zero(),
    );

    return total.cents;
  }

  get generalAddOnsSubtotalCents(): number {
    return this.generalAddOns.reduce(
      (sum, addOn) => sum + (addOn.totalCents ?? 0),
      0,
    );
  }

  get subtotalCents(): number {
    return Money.fromCents(this.curtainsSubtotalCents).add(
      Money.fromCents(this.generalAddOnsSubtotalCents),
    ).cents;
  }

  get discountValueCents(): number {
    return this.discount.calculateValueCents(this.subtotalCents);
  }

  get calculatedTotalCents(): number {
    return Money.fromCents(this.subtotalCents).subtract(
      Money.fromCents(this.discountValueCents),
    ).cents;
  }

  get effectiveCommercialAdjustmentCents(): number {
    return this.commercialAdjustmentCents ?? 0;
  }

  get totalCents(): number {
    return Money.fromCents(this.calculatedTotalCents).add(
      Money.fromCents(this.effectiveCommercialAdjustmentCents),
    ).cents;
  }
}

function normalizeAdjustment(value: number | null | undefined): number | null {
  if (value === null || value === undefined || value === 0) {
    return null;
  }

  if (!Number.isSafeInteger(value)) {
    throw new RangeError(
      'Commercial adjustment must be an integer amount in cents',
    );
  }

  return Money.fromCents(value).cents;
}

function normalizeText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();

  return normalized === '' ? null : normalized;
}

function assertValidDate(value: Date, label: string): void {
  if (Number.isNaN(value.getTime())) {
    throw new RangeError(`${label} must be a valid date`);
  }
}
