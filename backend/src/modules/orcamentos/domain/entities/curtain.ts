import { randomUUID } from 'node:crypto';
import type { FinancialItemPatch } from './financial-item.js';
import { FinancialItem, reconcileFinancialItems } from './financial-item.js';
import {
  calculateFabricQuantity,
  calculateFinalWidth,
  measureToMilli,
  milliToMeasure,
} from '../value-objects/measurements.js';

// Curtain is an internal Entity of the Quote aggregate (D83–D85). The
// aggregate owns its sequence and lifecycle; this Entity owns identity,
// measurement validation and intrinsic calculations. Height intentionally
// does not participate in the fabric quantity.

export const DEFAULT_BORDER_VALUE = 0.15;
export const DEFAULT_FABRIC_FACTOR = 3.5;

// Decimal(9,3) and Decimal(6,3) upper bounds from the schema.
const MAX_OPENING_WIDTH_MILLI = 999_999_999;
const MAX_HEIGHT_MILLI = 999_999_999;
const MAX_BORDER_MILLI = 999_999;
const MAX_FABRIC_FACTOR_MILLI = 999_999;

export interface CreateCurtainInput {
  sequence?: number;
  room?: string | null;
  description?: string | null;
  material?: string | null;
  openingWidth?: number | null;
  borderValue?: number | null;
  height?: number | null;
  fabricFactor?: number | null;
  notes?: string | null;
  components?: FinancialItem[];
}

export interface CurtainSnapshot {
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
  components: FinancialItem[];
}

// Partial update of an existing curtain (D117). Sequence is aggregate-owned
// and is not part of the patch. Components omitted keep the current set; a
// sent components array replaces it completely by id reconciliation.
export interface CurtainPatch {
  room?: string | null;
  description?: string | null;
  material?: string | null;
  openingWidth?: number | null;
  borderValue?: number | null;
  height?: number | null;
  fabricFactor?: number | null;
  notes?: string | null;
  components?: FinancialItemPatch[];
}

export class Curtain {
  private constructor(
    readonly id: string,
    public sequence: number,
    public room: string | null,
    public description: string | null,
    public material: string | null,
    public openingWidth: number | null,
    public borderValue: number | null,
    public height: number | null,
    public fabricFactor: number | null,
    public notes: string | null,
    public components: FinancialItem[],
  ) {}

  static create(input: CreateCurtainInput): Curtain {
    return new Curtain(
      randomUUID(),
      validatedSequence(input.sequence ?? 1),
      normalizeText(input.room),
      normalizeText(input.description),
      normalizeText(input.material),
      validatedMeasure(
        input.openingWidth,
        'Curtain opening width',
        MAX_OPENING_WIDTH_MILLI,
      ),
      validatedMeasure(
        input.borderValue ?? DEFAULT_BORDER_VALUE,
        'Curtain border value',
        MAX_BORDER_MILLI,
      ),
      validatedMeasure(input.height, 'Curtain height', MAX_HEIGHT_MILLI),
      validatedMeasure(
        input.fabricFactor ?? DEFAULT_FABRIC_FACTOR,
        'Curtain fabric factor',
        MAX_FABRIC_FACTOR_MILLI,
      ),
      normalizeText(input.notes),
      [...(input.components ?? [])],
    );
  }

  static rehydrate(snapshot: CurtainSnapshot): Curtain {
    return new Curtain(
      snapshot.id,
      snapshot.sequence,
      snapshot.room,
      snapshot.description,
      snapshot.material,
      snapshot.openingWidth,
      snapshot.borderValue,
      snapshot.height,
      snapshot.fabricFactor,
      snapshot.notes,
      snapshot.components,
    );
  }

  applyPatch(patch: CurtainPatch): void {
    if (patch.room !== undefined) {
      this.room = normalizeText(patch.room);
    }

    if (patch.description !== undefined) {
      this.description = normalizeText(patch.description);
    }

    if (patch.material !== undefined) {
      this.material = normalizeText(patch.material);
    }

    if (patch.openingWidth !== undefined) {
      this.openingWidth = validatedMeasure(
        patch.openingWidth,
        'Curtain opening width',
        MAX_OPENING_WIDTH_MILLI,
      );
    }

    if (patch.borderValue !== undefined) {
      this.borderValue = validatedMeasure(
        patch.borderValue,
        'Curtain border value',
        MAX_BORDER_MILLI,
      );
    }

    if (patch.height !== undefined) {
      this.height = validatedMeasure(
        patch.height,
        'Curtain height',
        MAX_HEIGHT_MILLI,
      );
    }

    if (patch.fabricFactor !== undefined) {
      this.fabricFactor = validatedMeasure(
        patch.fabricFactor,
        'Curtain fabric factor',
        MAX_FABRIC_FACTOR_MILLI,
      );
    }

    if (patch.notes !== undefined) {
      this.notes = normalizeText(patch.notes);
    }

    if (patch.components !== undefined) {
      this.components = reconcileFinancialItems(
        this.components,
        patch.components,
      );
    }
  }

  get finalWidth(): number | null {
    if (this.openingWidth === null || this.borderValue === null) {
      return null;
    }

    return calculateFinalWidth(this.openingWidth, this.borderValue);
  }

  get fabricQuantity(): number | null {
    if (this.finalWidth === null || this.fabricFactor === null) {
      return null;
    }

    return calculateFabricQuantity(this.finalWidth, this.fabricFactor);
  }

  // Incomplete items contribute nothing to the draft total; the send gate
  // requires every present component to be complete.
  get financialTotalCents(): number {
    return this.components.reduce(
      (total, component) => total + (component.totalCents ?? 0),
      0,
    );
  }
}

function validatedSequence(sequence: number): number {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError('Curtain sequence must be a positive integer');
  }

  return sequence;
}

function validatedMeasure(
  value: number | null | undefined,
  label: string,
  maxMilli: number,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const milli = measureToMilli(value, label);

  if (milli > maxMilli) {
    throw new RangeError(`${label} is outside the supported range`);
  }

  return milliToMeasure(milli);
}

function normalizeText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();

  return normalized === '' ? null : normalized;
}
