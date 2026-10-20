import { randomUUID } from 'node:crypto';
import { UnknownQuoteItemError } from '../errors/quote-domain.errors.js';
import {
  calculateItemTotalCents,
  MONEY_MAX_CENTS,
} from '../value-objects/money.js';
import {
  microToQuantity,
  quantityToMicro,
} from '../value-objects/measurements.js';

// Internal Entity shared semantically by curtain financial components and
// general add-ons (D87/D88). It has its own identity but no repository; the
// Quote aggregate owns its lifecycle. Labor is only a UX preset (D89).

export interface FinancialItemInput {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  unitPriceCents?: number | null;
}

export interface FinancialItemSnapshot {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  unitPriceCents: number | null;
}

// Partial update of an existing item (D117). Omitted fields keep their
// current value; null clears the field when absence is allowed. The optional
// id is used by collection reconciliation and ignored by update().
export interface FinancialItemPatch {
  id?: string | null;
  name?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unitPriceCents?: number | null;
}

export type FinancialItemScalarPatch = Omit<FinancialItemPatch, 'id'>;

// Decimal(12,6) upper bound for persisted quantities.
const MAX_QUANTITY_MICRO = 999_999_999_999;

export class FinancialItem {
  private constructor(
    readonly id: string,
    public name: string,
    public quantity: number | null,
    public unit: string | null,
    public unitPriceCents: number | null,
  ) {}

  static create(input: FinancialItemInput): FinancialItem {
    return new FinancialItem(
      randomUUID(),
      requiredName(input.name),
      validatedQuantity(input.quantity),
      normalizeUnit(input.unit),
      validatedUnitPrice(input.unitPriceCents),
    );
  }

  static rehydrate(snapshot: FinancialItemSnapshot): FinancialItem {
    return new FinancialItem(
      snapshot.id,
      snapshot.name,
      snapshot.quantity,
      snapshot.unit,
      snapshot.unitPriceCents,
    );
  }

  update(patch: FinancialItemScalarPatch): void {
    if (patch.name !== undefined) {
      this.name = requiredName(patch.name);
    }

    if (patch.quantity !== undefined) {
      this.quantity = validatedQuantity(patch.quantity);
    }

    if (patch.unit !== undefined) {
      this.unit = normalizeUnit(patch.unit);
    }

    if (patch.unitPriceCents !== undefined) {
      this.unitPriceCents = validatedUnitPrice(patch.unitPriceCents);
    }
  }

  get isComplete(): boolean {
    return this.quantity !== null && this.unitPriceCents !== null;
  }

  // Total is derived and never persisted. Drafts may keep the item incomplete;
  // in that case there is no total yet.
  get totalCents(): number | null {
    if (this.quantity === null || this.unitPriceCents === null) {
      return null;
    }

    return calculateItemTotalCents(
      quantityToMicro(this.quantity, 'Financial item quantity'),
      this.unitPriceCents,
    );
  }
}

function requiredName(value: string | null | undefined): string {
  const normalized = value === null || value === undefined ? '' : value.trim();

  if (normalized === '') {
    throw new Error('Financial item name is required');
  }

  return normalized;
}

function normalizeUnit(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();

  return normalized === '' ? null : normalized;
}

// Quantities are accepted with up to six decimal places because a fabric
// quantity produced by the domain can be copied into an item (D5).
function validatedQuantity(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const micro = quantityToMicro(value, 'Financial item quantity');

  if (micro <= 0) {
    throw new RangeError('Financial item quantity must be greater than zero');
  }

  if (micro > MAX_QUANTITY_MICRO) {
    throw new RangeError(
      'Financial item quantity is outside the supported range',
    );
  }

  return microToQuantity(micro);
}

function validatedUnitPrice(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isSafeInteger(value)) {
    throw new RangeError(
      'Financial item unit price must be an integer amount in cents',
    );
  }

  if (value <= 0) {
    throw new RangeError('Financial item unit price must be greater than zero');
  }

  if (value > MONEY_MAX_CENTS) {
    throw new RangeError(
      'Financial item unit price is outside the supported range',
    );
  }

  return value;
}

// D117 collection reconciliation: ids update existing items in place, items
// without an id are created, and existing items omitted from the sent
// collection are removed. Unknown or duplicated ids reject the whole patch.
export function assertFinancialItemPatchesReconcilable(
  current: FinancialItem[],
  patches: FinancialItemPatch[],
): void {
  const currentIds = new Set(current.map((item) => item.id));
  const seen = new Set<string>();

  for (const patch of patches) {
    if (patch.id === undefined || patch.id === null) {
      continue;
    }

    if (seen.has(patch.id)) {
      throw new UnknownQuoteItemError('Duplicate financial item id');
    }

    seen.add(patch.id);

    if (!currentIds.has(patch.id)) {
      throw new UnknownQuoteItemError('Unknown financial item id');
    }
  }
}

export function reconcileFinancialItems(
  current: FinancialItem[],
  patches: FinancialItemPatch[],
): FinancialItem[] {
  assertFinancialItemPatchesReconcilable(current, patches);

  const byId = new Map(current.map((item) => [item.id, item]));

  return patches.map((patch) => {
    if (patch.id !== undefined && patch.id !== null) {
      const existing = byId.get(patch.id);

      if (existing === undefined) {
        throw new UnknownQuoteItemError('Unknown financial item id');
      }

      existing.update(patch);

      return existing;
    }

    return FinancialItem.create({
      name: patch.name ?? '',
      quantity: patch.quantity,
      unit: patch.unit,
      unitPriceCents: patch.unitPriceCents,
    });
  });
}
