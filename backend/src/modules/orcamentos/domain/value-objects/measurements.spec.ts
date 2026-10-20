import { describe, expect, it } from 'vitest';
import {
  calculateFabricQuantity,
  calculateFabricQuantityMicro,
  calculateFinalWidth,
  calculateFinalWidthMilli,
  measureToMilli,
  microToQuantity,
  milliToMeasure,
  quantityToMicro,
} from './measurements.js';

describe('measureToMilli', () => {
  it('converts meters with up to three decimals to millimeters', () => {
    expect(measureToMilli(2, 'Opening width')).toBe(2_000);
    expect(measureToMilli(0.15, 'Border value')).toBe(150);
    expect(measureToMilli(2.375, 'Opening width')).toBe(2_375);
    expect(measureToMilli(0.001, 'Opening width')).toBe(1);
  });

  it('absorbs binary representation noise from decimal literals', () => {
    expect(measureToMilli(0.1 + 0.2, 'Opening width')).toBe(300);
  });

  it('rejects more than three decimal places', () => {
    expect(() => measureToMilli(2.0001, 'Opening width')).toThrow(RangeError);
    expect(() => measureToMilli(0.0001, 'Opening width')).toThrow(RangeError);
  });

  it('rejects negative, non-finite and unsafe values', () => {
    expect(() => measureToMilli(-0.1, 'Opening width')).toThrow(RangeError);
    expect(() => measureToMilli(Number.NaN, 'Opening width')).toThrow(
      RangeError,
    );
    expect(() =>
      measureToMilli(Number.POSITIVE_INFINITY, 'Opening width'),
    ).toThrow(RangeError);
  });
});

describe('quantityToMicro', () => {
  it('converts quantities with up to six decimals to millionths', () => {
    expect(quantityToMicro(1.5, 'Fabric quantity')).toBe(1_500_000);
    expect(quantityToMicro(8.05, 'Fabric quantity')).toBe(8_050_000);
    expect(quantityToMicro(1.002001, 'Fabric quantity')).toBe(1_002_001);
  });

  it('rejects more than six decimal places', () => {
    expect(() => quantityToMicro(0.0000001, 'Fabric quantity')).toThrow(
      RangeError,
    );
  });

  it('rejects negative quantities', () => {
    expect(() => quantityToMicro(-1, 'Fabric quantity')).toThrow(RangeError);
  });
});

describe('measurement conversions', () => {
  it('converts scaled integers back to meters', () => {
    expect(milliToMeasure(2_300)).toBe(2.3);
    expect(microToQuantity(8_050_000)).toBe(8.05);
  });

  it('rejects negative scaled integers', () => {
    expect(() => milliToMeasure(-1)).toThrow(RangeError);
    expect(() => microToQuantity(-1)).toThrow(RangeError);
  });
});

describe('calculateFinalWidth', () => {
  it('applies the border to both sides', () => {
    expect(calculateFinalWidthMilli(2_000, 150)).toBe(2_300);
    expect(calculateFinalWidth(2, 0.15)).toBe(2.3);
  });

  it('accepts a zero border', () => {
    expect(calculateFinalWidthMilli(2_000, 0)).toBe(2_000);
    expect(calculateFinalWidth(2, 0)).toBe(2);
  });

  it('rejects invalid scaled inputs', () => {
    expect(() => calculateFinalWidthMilli(-1, 150)).toThrow(RangeError);
    expect(() => calculateFinalWidthMilli(2_000, -1)).toThrow(RangeError);
    expect(() => calculateFinalWidthMilli(2.5, 150)).toThrow(RangeError);
  });
});

describe('calculateFabricQuantity', () => {
  it('multiplies final width by the fabric factor without rounding', () => {
    expect(calculateFabricQuantityMicro(2_300, 3_500)).toBe(8_050_000);
    expect(calculateFabricQuantity(2.3, 3.5)).toBe(8.05);
  });

  it('preserves six decimal places', () => {
    expect(calculateFabricQuantityMicro(2_300, 3_501)).toBe(8_052_300);
    expect(calculateFabricQuantityMicro(1_001, 1_001)).toBe(1_002_001);
    expect(calculateFabricQuantity(1.001, 1.001)).toBe(1.002001);
  });

  it('accepts a zero factor product', () => {
    expect(calculateFabricQuantityMicro(2_300, 0)).toBe(0);
  });

  it('rejects invalid scaled inputs', () => {
    expect(() => calculateFabricQuantityMicro(-1, 3_500)).toThrow(RangeError);
    expect(() => calculateFabricQuantityMicro(2_300, -1)).toThrow(RangeError);
  });
});
