import { randomUUID } from 'node:crypto';
import { Curtain, type CurtainPatch } from './curtain.js';
import {
  assertCurtainAssociation,
  assertFinancialItemPatchesReconcilable,
  FinancialItem,
  reconcileFinancialItems,
  type FinancialItemInput,
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
  financialItems?: FinancialItemInput[];
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

// `clientRef` identifies a curtain created by the current patch so new items
// can reference it before the aggregate assigns the definitive id. Existing
// curtains are referenced by `id`; the two forms are mutually exclusive.
export type QuoteCurtainPatch = CurtainPatch & {
  id?: string | null;
  clientRef?: string | null;
};

export interface QuotePatch extends UpdateQuoteEditableDataInput {
  curtains?: QuoteCurtainPatch[];
  financialItems?: FinancialItemPatch[];
}

// Patch already resolved against the aggregate: new curtains were created
// once with their definitive ids and every item references a concrete
// `curtainId`. Applying the same resolved patch to the validation copy and to
// the aggregate keeps both runs consistent.
interface ResolvedCurtainEntry {
  existingId: string | null;
  curtain: Curtain | null;
  patch: CurtainPatch;
}

interface ResolvedQuotePatch extends UpdateQuoteEditableDataInput {
  curtains?: ResolvedCurtainEntry[];
  financialItems?: FinancialItemPatch[];
}

export interface QuoteSnapshot {
  id: string;
  quoteNumber: QuoteNumber;
  customerId: string;
  status: QuoteStatus;
  installationAddress: InstallationAddress | null;
  curtains: Curtain[];
  financialItems: FinancialItem[];
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
    public financialItems: FinancialItem[],
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

    const id = randomUUID();
    const quote = new Quote(
      id,
      input.quoteNumber,
      input.customerId,
      QuoteStatus.DRAFT,
      input.installationAddress ?? null,
      [...(input.curtains ?? [])],
      (input.financialItems ?? []).map((item) =>
        FinancialItem.create(item, id),
      ),
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

    quote.assertCurrentFinancialItemsValid();
    quote.normalizeCurtainSequences();
    quote.assertTotalsInRange();

    return quote;
  }

  static rehydrate(snapshot: QuoteSnapshot): Quote {
    const quote = new Quote(
      snapshot.id,
      snapshot.quoteNumber,
      snapshot.customerId,
      snapshot.status,
      snapshot.installationAddress,
      snapshot.curtains,
      snapshot.financialItems,
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

    quote.assertCurrentFinancialItemsValid();
    return quote;
  }

  private assertCurrentFinancialItemsValid(): void {
    const curtainIds = new Set(this.curtains.map((curtain) => curtain.id));
    assertFinancialItemPatchesReconcilable(
      this.financialItems,
      this.financialItems.map((item) => ({ id: item.id })),
      this.id,
      curtainIds,
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
  // final state and is reconciled by id. The patch is resolved before any
  // mutation (identities, refs and values), applied to a copy for final-state
  // validation, and only then applied to the aggregate (atomic PATCH).
  applyPatch(patch: QuotePatch): void {
    if (this.status !== QuoteStatus.DRAFT && this.status !== QuoteStatus.SENT) {
      throw new QuoteNotEditableError();
    }

    const resolved = this.resolvePatch(patch);
    const candidate = this.copyForPatchValidation();
    candidate.applyResolvedPatch(resolved);
    candidate.assertPatchedStateValid();

    this.applyResolvedPatch(resolved);
  }

  private applyResolvedPatch(patch: ResolvedQuotePatch): void {
    this.updateEditableData({
      installationAddress: patch.installationAddress,
      discount: patch.discount,
      commercialAdjustmentCents: patch.commercialAdjustmentCents,
      notes: patch.notes,
    });

    if (patch.curtains !== undefined) {
      this.reconcileResolvedCurtains(patch.curtains);
    }

    if (patch.financialItems !== undefined) {
      this.financialItems = reconcileFinancialItems(
        this.financialItems,
        patch.financialItems,
        this.id,
        new Set(this.curtains.map((curtain) => curtain.id)),
      );
    }
  }

  private reconcileResolvedCurtains(entries: ResolvedCurtainEntry[]): void {
    const byId = new Map(this.curtains.map((curtain) => [curtain.id, curtain]));

    this.curtains = entries.map((entry) => {
      if (entry.curtain !== null) {
        return entry.curtain;
      }

      const existing = byId.get(entry.existingId ?? '');

      if (existing === undefined) {
        throw new UnknownQuoteItemError('Unknown curtain id');
      }

      existing.applyPatch(entry.patch);

      return existing;
    });

    this.normalizeCurtainSequences();
    const curtainIds = new Set(this.curtains.map((curtain) => curtain.id));
    this.financialItems = this.financialItems.filter(
      (item) => item.curtainId === null || curtainIds.has(item.curtainId),
    );
  }

  private assertPatchedStateValid(): void {
    // D86 applies to every saved state, including drafts, so an edit cannot
    // persist totals that the read model cannot derive. D87/D95 additionally
    // require a non-draft save to keep the address and every item complete;
    // reusing the send gate keeps the quote valid for a later confirmation.
    if (this.status === QuoteStatus.DRAFT) {
      this.assertTotalsInRange();
    } else {
      const violations = this.validateForSend();

      if (violations.length > 0) {
        throw new QuoteValidationError(violations);
      }
    }
  }

  private copyForPatchValidation(): Quote {
    return Quote.rehydrate({
      id: this.id,
      quoteNumber: this.quoteNumber,
      customerId: this.customerId,
      status: this.status,
      installationAddress: this.installationAddress,
      curtains: this.curtains.map((curtain) =>
        Curtain.rehydrate({
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
        }),
      ),
      financialItems: this.financialItems.map((item) =>
        FinancialItem.rehydrate({
          id: item.id,
          quoteId: item.quoteId,
          curtainId: item.curtainId,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          unitPriceCents: item.unitPriceCents,
        }),
      ),
      discount: this.discount,
      commercialAdjustmentCents: this.commercialAdjustmentCents,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      firstSentAt: this.firstSentAt,
      validUntil: this.validUntil,
      confirmedAt: this.confirmedAt,
      productionStartedAt: this.productionStartedAt,
      scheduledInstallationAt: this.scheduledInstallationAt,
      completedAt: this.completedAt,
    });
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
    const rangeViolation = this.totalRangeViolation();

    if (rangeViolation !== null) {
      return [rangeViolation];
    }

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

      const curtainItems = this.financialItemsForCurtain(curtain.id);

      if (!curtainItems.some(isCompleteItem)) {
        violations.push({
          code: 'CURTAIN_COMPONENT_REQUIRED',
          message: `${label} must have at least one complete component`,
        });
      }

      for (const component of curtainItems) {
        if (!isCompleteItem(component)) {
          violations.push({
            code: 'COMPONENT_INVALID',
            message: `${label} component "${component.name}" must have quantity and unit price greater than zero`,
          });
        }
      }
    }

    for (const addOn of this.generalFinancialItems) {
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
  // a transition conflict. The commercial composition is revalidated because
  // SENT quotes are editable; an inconsistent aggregate can never be
  // confirmed.
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

    const rangeViolation = this.totalRangeViolation();

    if (rangeViolation !== null) {
      throw new QuoteValidationError([rangeViolation]);
    }

    const violations = this.commercialCompositionViolations();

    if (violations.length > 0) {
      throw new QuoteValidationError(violations);
    }

    this._status = QuoteStatus.CONFIRMED;
    this.confirmedAt = now;
  }

  // Commercial composition only: the financial collection must still be
  // complete and produce a positive, coherent total.
  private commercialCompositionViolations(): QuoteValidationViolation[] {
    const violations: QuoteValidationViolation[] = [];

    if (this.curtains.length === 0) {
      violations.push({
        code: 'NO_CURTAINS',
        message: 'At least one curtain is required',
      });
    }

    for (const curtain of this.curtains) {
      const label = `Curtain ${curtain.sequence}`;
      const curtainItems = this.financialItemsForCurtain(curtain.id);

      if (!curtainItems.some(isCompleteItem)) {
        violations.push({
          code: 'CURTAIN_COMPONENT_REQUIRED',
          message: `${label} must have at least one complete component`,
        });
      }

      for (const item of curtainItems) {
        if (!isCompleteItem(item)) {
          violations.push({
            code: 'COMPONENT_INVALID',
            message: `${label} component "${item.name}" must have quantity and unit price greater than zero`,
          });
        }
      }
    }

    for (const item of this.generalFinancialItems) {
      if (!isCompleteItem(item)) {
        violations.push({
          code: 'GENERAL_ADD_ON_INVALID',
          message: `General add-on "${item.name}" must have quantity and unit price greater than zero`,
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

  // D99/D106: a SENT quote may be renewed while valid or after expiry. The
  // previous validity is returned for history composition. A SENT quote
  // without a validity is an inconsistent state and is blocked.
  renew(validUntil: Date, now: Date): Date {
    this.assertStatus(QuoteStatus.SENT);
    assertValidDate(validUntil, 'Quote valid until');
    assertValidDate(now, 'Quote renewal instant');

    if (this.validUntil === null) {
      throw new InvalidQuoteTransitionError(
        'Quote cannot be renewed without a validity',
      );
    }

    if (validUntil.getTime() <= now.getTime()) {
      throw new QuoteValidationError([
        {
          code: 'VALID_UNTIL_NOT_FUTURE',
          message: 'Quote valid until must be strictly in the future',
        },
      ]);
    }

    const previousValidUntil = this.validUntil;

    this.validUntil = validUntil;

    return previousValidUntil;
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

    // D105: a scheduled installation in the future blocks completion.
    if (
      this.scheduledInstallationAt !== null &&
      this.scheduledInstallationAt.getTime() > now.getTime()
    ) {
      throw new InvalidQuoteTransitionError(
        'Quote cannot be completed before the scheduled installation',
      );
    }

    this._status = QuoteStatus.COMPLETED;
    this.completedAt = now;
  }

  // D110: physical deletion is allowed only while the quote is a DRAFT.
  assertDraftForDeletion(): void {
    this.assertStatus(QuoteStatus.DRAFT);
  }

  private assertStatus(...allowed: QuoteStatus[]): void {
    if (!allowed.includes(this._status)) {
      throw new InvalidQuoteTransitionError(
        `Transition is not allowed from ${this._status}`,
      );
    }
  }

  private assertTotalsInRange(): void {
    const violation = this.totalRangeViolation();

    if (violation !== null) {
      throw new QuoteValidationError([violation]);
    }
  }

  // D86: derived totals must fit the persisted Int32 range. The money value
  // objects throw RangeError when an operation leaves that range; it becomes
  // a business validation instead of an unmapped 500.
  private totalRangeViolation(): QuoteValidationViolation | null {
    try {
      void this.totalCents;

      return null;
    } catch (error) {
      if (error instanceof RangeError) {
        return {
          code: 'TOTAL_OUT_OF_RANGE',
          message: 'Quote totals must fit the supported monetary range',
        };
      }

      throw error;
    }
  }

  normalizeCurtainSequences(): void {
    this.curtains.forEach((curtain, index) => {
      curtain.sequence = index + 1;
    });
  }

  // Resolves the patch once: validates identities, refs and values and creates
  // new curtains with their definitive ids. `curtainRef` is translated to the
  // generated `curtainId`, so the validation copy and the aggregate apply the
  // exact same final state (atomic PATCH over the final state).
  private resolvePatch(patch: QuotePatch): ResolvedQuotePatch {
    if (patch.commercialAdjustmentCents !== undefined) {
      normalizeAdjustment(patch.commercialAdjustmentCents);
    }

    const resolved: ResolvedQuotePatch = {
      installationAddress: patch.installationAddress,
      discount: patch.discount,
      commercialAdjustmentCents: patch.commercialAdjustmentCents,
      notes: patch.notes,
    };
    const currentCurtains = new Map(
      this.curtains.map((curtain) => [curtain.id, curtain]),
    );
    const createdByRef = new Map<string, Curtain>();

    if (patch.curtains !== undefined) {
      resolved.curtains = this.resolveCurtainPatches(
        patch.curtains,
        currentCurtains,
        createdByRef,
      );
    }

    if (patch.financialItems !== undefined) {
      const targetCurtainIds =
        resolved.curtains === undefined
          ? new Set(currentCurtains.keys())
          : new Set(
              resolved.curtains.map(
                (entry) => entry.existingId ?? entry.curtain?.id ?? '',
              ),
            );

      resolved.financialItems = this.resolveFinancialItemPatches(
        patch.financialItems,
        targetCurtainIds,
        createdByRef,
      );
    }

    return resolved;
  }

  private resolveCurtainPatches(
    patches: QuoteCurtainPatch[],
    currentCurtains: ReadonlyMap<string, Curtain>,
    createdByRef: Map<string, Curtain>,
  ): ResolvedCurtainEntry[] {
    const seenIds = new Set<string>();
    const seenRefs = new Set<string>();

    return patches.map((curtainPatch) => {
      const id = curtainPatch.id ?? null;

      if (id !== null) {
        if (
          curtainPatch.clientRef !== undefined &&
          curtainPatch.clientRef !== null
        ) {
          throw new UnknownQuoteItemError(
            'clientRef is only accepted for new curtains',
          );
        }

        if (!currentCurtains.has(id)) {
          throw new UnknownQuoteItemError('Unknown curtain id');
        }

        if (seenIds.has(id)) {
          throw new UnknownQuoteItemError('Duplicate curtain id');
        }

        seenIds.add(id);

        return {
          existingId: id,
          curtain: null,
          patch: curtainFieldsOf(curtainPatch),
        };
      }

      const clientRef = normalizeClientRef(curtainPatch.clientRef);

      if (clientRef !== undefined) {
        if (seenRefs.has(clientRef)) {
          throw new UnknownQuoteItemError('Duplicate curtain clientRef');
        }

        seenRefs.add(clientRef);
      }

      const curtain = Curtain.create(curtainFieldsOf(curtainPatch));

      if (clientRef !== undefined) {
        createdByRef.set(clientRef, curtain);
      }

      return { existingId: null, curtain, patch: {} };
    });
  }

  private resolveFinancialItemPatches(
    patches: FinancialItemPatch[],
    targetCurtainIds: ReadonlySet<string>,
    createdByRef: ReadonlyMap<string, Curtain>,
  ): FinancialItemPatch[] {
    const currentById = new Map(
      this.financialItems.map((item) => [item.id, item]),
    );
    const seenIds = new Set<string>();

    return patches.map((itemPatch) => {
      const resolved: FinancialItemPatch = {
        id: itemPatch.id ?? null,
        name: itemPatch.name,
        quantity: itemPatch.quantity,
        unit: itemPatch.unit,
        unitPriceCents: itemPatch.unitPriceCents,
      };
      const id = itemPatch.id ?? null;

      if (id !== null) {
        if (seenIds.has(id)) {
          throw new UnknownQuoteItemError('Duplicate financial item id');
        }

        seenIds.add(id);

        const existing = currentById.get(id);

        if (existing === undefined) {
          throw new UnknownQuoteItemError('Unknown financial item id');
        }

        if (
          itemPatch.curtainRef !== undefined &&
          itemPatch.curtainRef !== null
        ) {
          throw new UnknownQuoteItemError(
            'curtainRef is only accepted for new items',
          );
        }

        resolved.curtainId = itemPatch.curtainId;
        assertCurtainAssociation(
          itemPatch.curtainId === undefined
            ? existing.curtainId
            : itemPatch.curtainId,
          targetCurtainIds,
        );
        validateFinancialItemUpdate(existing, resolved);

        return resolved;
      }

      if (
        itemPatch.curtainId !== undefined &&
        itemPatch.curtainRef !== undefined &&
        itemPatch.curtainRef !== null
      ) {
        throw new UnknownQuoteItemError(
          'curtainId and curtainRef are mutually exclusive',
        );
      }

      if (itemPatch.curtainRef !== undefined && itemPatch.curtainRef !== null) {
        const ref = normalizeClientRef(itemPatch.curtainRef);
        const created = ref === undefined ? undefined : createdByRef.get(ref);

        if (created === undefined) {
          throw new UnknownQuoteItemError('Unknown curtainRef');
        }

        resolved.curtainId = created.id;
      } else if (itemPatch.curtainId !== undefined) {
        resolved.curtainId = itemPatch.curtainId;
      }

      assertCurtainAssociation(resolved.curtainId ?? null, targetCurtainIds);
      FinancialItem.create(
        {
          name: itemPatch.name ?? '',
          quantity: itemPatch.quantity,
          unit: itemPatch.unit,
          unitPriceCents: itemPatch.unitPriceCents,
          curtainId: resolved.curtainId ?? null,
        },
        this.id,
      );

      return resolved;
    });
  }

  financialItemsForCurtain(curtainId: string): FinancialItem[] {
    return this.financialItems.filter((item) => item.curtainId === curtainId);
  }

  get generalFinancialItems(): FinancialItem[] {
    return this.financialItems.filter((item) => item.curtainId === null);
  }

  get curtainsSubtotalCents(): number {
    const total = this.curtains.reduce(
      (sum, curtain) =>
        sum.add(
          Money.fromCents(
            this.financialItemsForCurtain(curtain.id).reduce(
              (itemTotal, item) => itemTotal + (item.totalCents ?? 0),
              0,
            ),
          ),
        ),
      Money.zero(),
    );

    return total.cents;
  }

  get generalAddOnsSubtotalCents(): number {
    return this.generalFinancialItems.reduce(
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

// Scalar curtain fields only; identity and clientRef never reach the Entity.
function curtainFieldsOf(patch: CurtainPatch): CurtainPatch {
  return {
    room: patch.room,
    description: patch.description,
    material: patch.material,
    openingWidth: patch.openingWidth,
    borderValue: patch.borderValue,
    height: patch.height,
    fabricFactor: patch.fabricFactor,
    notes: patch.notes,
  };
}

// Validates a patch against a copy so an invalid value rejects the whole
// patch without mutating the current item.
function validateFinancialItemUpdate(
  existing: FinancialItem,
  patch: FinancialItemPatch,
): void {
  const candidate = FinancialItem.rehydrate({
    id: existing.id,
    quoteId: existing.quoteId,
    curtainId: existing.curtainId,
    name: existing.name,
    quantity: existing.quantity,
    unit: existing.unit,
    unitPriceCents: existing.unitPriceCents,
  });

  candidate.update({
    curtainId: patch.curtainId,
    name: patch.name,
    quantity: patch.quantity,
    unit: patch.unit,
    unitPriceCents: patch.unitPriceCents,
  });
}

export function normalizeClientRef(
  value: string | null | undefined,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = value.trim();

  if (normalized === '') {
    throw new UnknownQuoteItemError('Curtain clientRef must not be empty');
  }

  return normalized;
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
