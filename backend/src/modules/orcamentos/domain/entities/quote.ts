import { randomUUID } from 'node:crypto';
import { Curtain, type CurtainPatch } from './curtain.js';
import {
  assertFinancialItemPatchesReconcilable,
  FinancialItem,
  reconcileFinancialItems,
  type FinancialItemPatch,
} from './financial-item.js';
import {
  InvalidQuoteTransitionError,
  QuoteNotEditableError,
  QuoteValidationError,
  UnknownQuoteItemError,
  type QuoteValidationViolation,
} from '../errors/quote-domain.errors.js';
import { Discount } from '../value-objects/discount.js';
import type { InstallationAddress } from '../value-objects/installation-address.js';
import { Money } from '../value-objects/money.js';
import type { QuoteNumber } from '../value-objects/quote-number.js';

// Quote Aggregate Root (D76). It owns the commercial composition and derived
// totals. History is deliberately not loaded with the aggregate; lifecycle
// transitions belong to later domain tasks.

const DEFAULT_VALIDITY_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;

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

export type QuoteCurtainPatch = Omit<CurtainPatch, 'components'> & {
  id?: string | null;
  components?: FinancialItemPatch[];
};

export interface QuotePatch extends UpdateQuoteEditableDataInput {
  curtains?: QuoteCurtainPatch[];
  generalAddOns?: FinancialItemPatch[];
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

export type InstallationAction = 'SCHEDULED' | 'CHANGED' | 'UNCHANGED';

// Values removed by a reopening, handed to the Application so it can compose
// QUOTE_REOPENED.details (D100). The aggregate keeps no history itself.
export interface QuoteReopeningDetails {
  previousConfirmedAt: Date | null;
  previousScheduledInstallationAt: Date | null;
}

export class Quote {
  private constructor(
    readonly id: string,
    readonly quoteNumber: QuoteNumber,
    readonly customerId: string,
    private _status: QuoteStatus,
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

  get status(): QuoteStatus {
    return this._status;
  }

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

  // Full D117 patch. Scalar fields and each editable collection follow the
  // same rules: omitted means unchanged; a sent collection is the complete
  // state and is reconciled by id. Known and duplicated ids are checked
  // before any mutation so a malformed patch is rejected up front.
  applyPatch(patch: QuotePatch): void {
    if (this.status !== QuoteStatus.DRAFT && this.status !== QuoteStatus.SENT) {
      throw new QuoteNotEditableError();
    }

    this.assertPatchReconcilable(patch);

    this.updateEditableData({
      installationAddress: patch.installationAddress,
      discount: patch.discount,
      commercialAdjustmentCents: patch.commercialAdjustmentCents,
      notes: patch.notes,
    });

    if (patch.curtains !== undefined) {
      this.reconcileCurtains(patch.curtains);
    }

    if (patch.generalAddOns !== undefined) {
      this.generalAddOns = reconcileFinancialItems(
        this.generalAddOns,
        patch.generalAddOns,
      );
    }
  }

  // State machine (D96). Transitions are only reachable through these
  // methods; status is exposed read-only. The reference instant is always
  // supplied by the caller so the domain performs no implicit clock reads.

  markAsSent(now: Date, validUntil?: Date | null): void {
    this.assertStatus(QuoteStatus.DRAFT);
    assertValidDate(now, 'Quote sending instant');

    if (validUntil !== null && validUntil !== undefined) {
      assertValidDate(validUntil, 'Quote valid until');
    }

    const violations = this.validateForSend();

    // D98: an explicitly informed validity must be strictly in the future;
    // otherwise the default of now + 30 days is applied.
    if (
      validUntil !== null &&
      validUntil !== undefined &&
      validUntil.getTime() <= now.getTime()
    ) {
      violations.push({
        code: 'VALID_UNTIL_NOT_FUTURE',
        message: 'Quote valid until must be strictly in the future',
      });
    }

    if (violations.length > 0) {
      throw new QuoteValidationError(violations);
    }

    this.firstSentAt = now;
    this.validUntil =
      validUntil ?? new Date(now.getTime() + DEFAULT_VALIDITY_MILLISECONDS);
    this._status = QuoteStatus.SENT;
  }

  // D97 sending gate. Customer existence/activity belongs to the application
  // layer because Customer is a separate aggregate. Validity is added by the
  // temporal-rules task.
  validateForSend(): QuoteValidationViolation[] {
    const violations: QuoteValidationViolation[] = [];

    if (
      this.installationAddress === null ||
      !this.installationAddress.isComplete()
    ) {
      violations.push({
        code: 'INSTALLATION_ADDRESS_INCOMPLETE',
        message: 'Installation address is incomplete',
      });
    }

    if (this.curtains.length === 0) {
      violations.push({
        code: 'NO_CURTAINS',
        message: 'At least one curtain is required',
      });
    }

    for (const curtain of this.curtains) {
      const label = `Curtain ${curtain.sequence}`;

      if (curtain.room === null) {
        violations.push({
          code: 'CURTAIN_ROOM_REQUIRED',
          message: `${label} must have a room`,
        });
      }

      if (curtain.openingWidth === null || curtain.openingWidth <= 0) {
        violations.push({
          code: 'CURTAIN_OPENING_WIDTH_INVALID',
          message: `${label} opening width must be greater than zero`,
        });
      }

      if (curtain.height === null || curtain.height <= 0) {
        violations.push({
          code: 'CURTAIN_HEIGHT_INVALID',
          message: `${label} height must be greater than zero`,
        });
      }

      if (curtain.borderValue === null || curtain.borderValue < 0) {
        violations.push({
          code: 'CURTAIN_BORDER_INVALID',
          message: `${label} border must be informed and not negative`,
        });
      }

      if (curtain.fabricFactor === null || curtain.fabricFactor <= 0) {
        violations.push({
          code: 'CURTAIN_FABRIC_FACTOR_INVALID',
          message: `${label} fabric factor must be greater than zero`,
        });
      }

      if (curtain.material === null) {
        violations.push({
          code: 'CURTAIN_MATERIAL_REQUIRED',
          message: `${label} must have a material`,
        });
      }

      if (!curtain.components.some(isCompleteItem)) {
        violations.push({
          code: 'CURTAIN_COMPONENT_REQUIRED',
          message: `${label} must have at least one complete component`,
        });
      }

      for (const component of curtain.components) {
        if (!isCompleteItem(component)) {
          violations.push({
            code: 'COMPONENT_INVALID',
            message: `${label} component "${component.name}" must have quantity and unit price greater than zero`,
          });
        }
      }
    }

    for (const addOn of this.generalAddOns) {
      if (!isCompleteItem(addOn)) {
        violations.push({
          code: 'GENERAL_ADD_ON_INVALID',
          message: `General add-on "${addOn.name}" must have quantity and unit price greater than zero`,
        });
      }
    }

    if (!this.discount.isApplicableTo(this.subtotalCents)) {
      violations.push({
        code: 'DISCOUNT_EXCEEDS_SUBTOTAL',
        message: 'Discount must not exceed the quote subtotal',
      });
    }

    if (this.totalCents <= 0) {
      violations.push({
        code: 'TOTAL_NOT_POSITIVE',
        message: 'Quote total must be greater than zero',
      });
    }

    return violations;
  }

  // D99: confirmation requires SENT and a validity that has not elapsed. A
  // SENT quote without validUntil is an inconsistent state and is blocked as
  // a transition conflict.
  confirm(now: Date): void {
    this.assertStatus(QuoteStatus.SENT);
    assertValidDate(now, 'Quote confirmation instant');

    if (this.validUntil === null) {
      throw new InvalidQuoteTransitionError(
        'Quote cannot be confirmed without a validity',
      );
    }

    if (now.getTime() > this.validUntil.getTime()) {
      throw new InvalidQuoteTransitionError('Quote has expired');
    }

    this._status = QuoteStatus.CONFIRMED;
    this.confirmedAt = now;
  }

  // D100: reopening clears the confirmation and the installation schedule,
  // preserves firstSentAt/validUntil and does not renew the validity. The
  // cleared values are returned for history composition.
  reopen(): QuoteReopeningDetails {
    this.assertStatus(QuoteStatus.CONFIRMED);

    const details: QuoteReopeningDetails = {
      previousConfirmedAt: this.confirmedAt,
      previousScheduledInstallationAt: this.scheduledInstallationAt,
    };

    this._status = QuoteStatus.SENT;
    this.confirmedAt = null;
    this.scheduledInstallationAt = null;

    return details;
  }

  renew(validUntil: Date, now: Date): void {
    this.assertStatus(QuoteStatus.SENT);
    assertValidDate(validUntil, 'Quote valid until');
    assertValidDate(now, 'Quote renewal instant');

    if (validUntil.getTime() <= now.getTime()) {
      throw new QuoteValidationError([
        {
          code: 'VALID_UNTIL_NOT_FUTURE',
          message: 'Quote valid until must be strictly in the future',
        },
      ]);
    }

    this.validUntil = validUntil;
  }

  // D106: expiration is derived and never persisted.
  isExpired(now: Date): boolean {
    assertValidDate(now, 'Quote expiration reference instant');

    return (
      this._status === QuoteStatus.SENT &&
      this.validUntil !== null &&
      now.getTime() > this.validUntil.getTime()
    );
  }

  // D107: a late installation is derived and never becomes a status.
  isLateInstallation(now: Date): boolean {
    assertValidDate(now, 'Quote late installation reference instant');

    return (
      this.scheduledInstallationAt !== null &&
      this.scheduledInstallationAt.getTime() < now.getTime() &&
      (this._status === QuoteStatus.CONFIRMED ||
        this._status === QuoteStatus.IN_PRODUCTION)
    );
  }

  cancel(reason?: string | null): string | null {
    this.assertStatus(
      QuoteStatus.DRAFT,
      QuoteStatus.SENT,
      QuoteStatus.CONFIRMED,
    );

    const normalizedReason = normalizeCancellationReason(reason);

    this._status = QuoteStatus.CANCELLED;

    return normalizedReason;
  }

  startProduction(now: Date): void {
    this.assertStatus(QuoteStatus.CONFIRMED);
    assertValidDate(now, 'Quote production start instant');

    this._status = QuoteStatus.IN_PRODUCTION;
    this.productionStartedAt = now;
  }

  setScheduledInstallation(instant: Date): InstallationAction {
    this.assertStatus(QuoteStatus.CONFIRMED, QuoteStatus.IN_PRODUCTION);
    assertValidDate(instant, 'Quote scheduled installation instant');

    if (this.scheduledInstallationAt?.getTime() === instant.getTime()) {
      return 'UNCHANGED';
    }

    const action =
      this.scheduledInstallationAt === null ? 'SCHEDULED' : 'CHANGED';

    this.scheduledInstallationAt = instant;

    return action;
  }

  removeScheduledInstallation(): Date | null {
    this.assertStatus(QuoteStatus.CONFIRMED, QuoteStatus.IN_PRODUCTION);

    const previous = this.scheduledInstallationAt;

    this.scheduledInstallationAt = null;

    return previous;
  }

  complete(now: Date): void {
    this.assertStatus(QuoteStatus.IN_PRODUCTION);
    assertValidDate(now, 'Quote completion instant');

    this._status = QuoteStatus.COMPLETED;
    this.completedAt = now;
  }

  private assertStatus(...allowed: QuoteStatus[]): void {
    if (!allowed.includes(this._status)) {
      throw new InvalidQuoteTransitionError(
        `Transition is not allowed from ${this._status}`,
      );
    }
  }

  normalizeCurtainSequences(): void {
    this.curtains.forEach((curtain, index) => {
      curtain.sequence = index + 1;
    });
  }

  private assertPatchReconcilable(patch: QuotePatch): void {
    if (patch.commercialAdjustmentCents !== undefined) {
      normalizeAdjustment(patch.commercialAdjustmentCents);
    }

    if (patch.generalAddOns !== undefined) {
      assertFinancialItemPatchesReconcilable(
        this.generalAddOns,
        patch.generalAddOns,
      );
    }

    if (patch.curtains === undefined) {
      return;
    }

    const byId = new Map(this.curtains.map((curtain) => [curtain.id, curtain]));
    const seen = new Set<string>();

    for (const curtainPatch of patch.curtains) {
      if (curtainPatch.id === undefined || curtainPatch.id === null) {
        if (curtainPatch.components !== undefined) {
          assertFinancialItemPatchesReconcilable([], curtainPatch.components);
        }

        continue;
      }

      if (seen.has(curtainPatch.id)) {
        throw new UnknownQuoteItemError('Duplicate curtain id');
      }

      seen.add(curtainPatch.id);

      const existing = byId.get(curtainPatch.id);

      if (existing === undefined) {
        throw new UnknownQuoteItemError('Unknown curtain id');
      }

      if (curtainPatch.components !== undefined) {
        assertFinancialItemPatchesReconcilable(
          existing.components,
          curtainPatch.components,
        );
      }
    }
  }

  private reconcileCurtains(patches: QuoteCurtainPatch[]): void {
    const byId = new Map(this.curtains.map((curtain) => [curtain.id, curtain]));

    this.curtains = patches.map((patch) => {
      if (patch.id !== undefined && patch.id !== null) {
        const existing = byId.get(patch.id);

        if (existing === undefined) {
          throw new UnknownQuoteItemError('Unknown curtain id');
        }

        existing.applyPatch(patch);

        return existing;
      }

      const curtain = Curtain.create({
        room: patch.room,
        description: patch.description,
        material: patch.material,
        openingWidth: patch.openingWidth,
        borderValue: patch.borderValue,
        height: patch.height,
        fabricFactor: patch.fabricFactor,
        notes: patch.notes,
      });

      if (patch.components !== undefined) {
        curtain.applyPatch({ components: patch.components });
      }

      return curtain;
    });

    this.normalizeCurtainSequences();
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

function isCompleteItem(item: FinancialItem): boolean {
  return (
    item.quantity !== null &&
    item.quantity > 0 &&
    item.unitPriceCents !== null &&
    item.unitPriceCents > 0
  );
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

function normalizeCancellationReason(
  reason: string | null | undefined,
): string | null {
  const normalized = normalizeText(reason);

  if (normalized !== null && normalized.length > 500) {
    throw new RangeError(
      'Cancellation reason must have at most 500 characters',
    );
  }

  return normalized;
}

function assertValidDate(value: Date, label: string): void {
  if (Number.isNaN(value.getTime())) {
    throw new RangeError(`${label} must be a valid date`);
  }
}
