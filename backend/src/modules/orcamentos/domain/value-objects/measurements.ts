// Measurements are exchanged in meters but computed as scaled integers so
// that no binary floating point arithmetic leaks into business results.
// input measures and factors: scale 3 (milli)
// derived fabric quantity: scale 6 (micro)

export const MEASURE_SCALE = 3;
export const QUANTITY_SCALE = 6;

const MILLI_FACTOR = 1_000;
const MICRO_FACTOR = 1_000_000;
const SCALE_EPSILON = 1e-6;

export function measureToMilli(value: number, label: string): number {
  return toScaledInteger(value, MILLI_FACTOR, label);
}

export function quantityToMicro(value: number, label: string): number {
  return toScaledInteger(value, MICRO_FACTOR, label);
}

export function milliToMeasure(milli: number): number {
  assertScaledInteger(milli, 'Measure milli');

  return milli / MILLI_FACTOR;
}

export function microToQuantity(micro: number): number {
  assertScaledInteger(micro, 'Quantity micro');

  return micro / MICRO_FACTOR;
}

export function calculateFinalWidthMilli(
  openingWidthMilli: number,
  borderMilli: number,
): number {
  assertScaledInteger(openingWidthMilli, 'Opening width milli');
  assertScaledInteger(borderMilli, 'Border milli');

  return openingWidthMilli + 2 * borderMilli;
}

export function calculateFabricQuantityMicro(
  finalWidthMilli: number,
  fabricFactorMilli: number,
): number {
  assertScaledInteger(finalWidthMilli, 'Final width milli');
  assertScaledInteger(fabricFactorMilli, 'Fabric factor milli');

  const quantity = finalWidthMilli * fabricFactorMilli;

  if (!Number.isSafeInteger(quantity)) {
    throw new RangeError('Fabric quantity is outside the supported range');
  }

  return quantity;
}

export function calculateFinalWidth(
  openingWidth: number,
  borderValue: number,
): number {
  return milliToMeasure(
    calculateFinalWidthMilli(
      measureToMilli(openingWidth, 'Opening width'),
      measureToMilli(borderValue, 'Border value'),
    ),
  );
}

export function calculateFabricQuantity(
  finalWidth: number,
  fabricFactor: number,
): number {
  return microToQuantity(
    calculateFabricQuantityMicro(
      measureToMilli(finalWidth, 'Final width'),
      measureToMilli(fabricFactor, 'Fabric factor'),
    ),
  );
}

function toScaledInteger(value: number, factor: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number`);
  }

  if (value < 0) {
    throw new RangeError(`${label} must not be negative`);
  }

  const scaled = value * factor;
  const rounded = Math.round(scaled);

  if (Math.abs(scaled - rounded) >= SCALE_EPSILON) {
    throw new RangeError(`${label} has more decimal places than supported`);
  }

  if (!Number.isSafeInteger(rounded)) {
    throw new RangeError(`${label} is outside the supported range`);
  }

  return rounded;
}

function assertScaledInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }

  if (value < 0) {
    throw new RangeError(`${label} must not be negative`);
  }
}
