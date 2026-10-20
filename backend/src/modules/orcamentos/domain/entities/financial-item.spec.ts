import { describe, expect, it } from 'vitest';
import { FinancialItem } from './financial-item.js';

describe('FinancialItem', () => {
  it('creates a complete item', () => {
    const item = FinancialItem.create({
      name: '  Mão de obra ',
      quantity: 8.05,
      unit: ' m ',
      unitPriceCents: 3_000,
    });

    expect(item.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(item.name).toBe('Mão de obra');
    expect(item.quantity).toBe(8.05);
    expect(item.unit).toBe('m');
    expect(item.unitPriceCents).toBe(3_000);
    expect(item.isComplete).toBe(true);
  });

  it('accepts an incomplete item while the quote is a draft', () => {
    const withoutPrice = FinancialItem.create({
      name: 'Instalação',
      quantity: 2.125,
    });
    const withoutQuantity = FinancialItem.create({
      name: 'Instalação',
      unitPriceCents: 5_000,
    });

    expect(withoutPrice.isComplete).toBe(false);
    expect(withoutPrice.totalCents).toBeNull();
    expect(withoutQuantity.isComplete).toBe(false);
    expect(withoutQuantity.totalCents).toBeNull();
  });

  it('normalizes an absent or blank unit to null', () => {
    expect(FinancialItem.create({ name: 'Item' }).unit).toBeNull();
    expect(FinancialItem.create({ name: 'Item', unit: '   ' }).unit).toBeNull();
  });

  it('requires a non-empty name', () => {
    expect(() => FinancialItem.create({ name: '' })).toThrow(Error);
    expect(() => FinancialItem.create({ name: '   ' })).toThrow(Error);
  });

  it('rejects zero and negative quantities', () => {
    for (const quantity of [0, -1, -0.000001]) {
      expect(() => FinancialItem.create({ name: 'Item', quantity })).toThrow(
        RangeError,
      );
    }
  });

  it('rejects quantities with more than six decimal places', () => {
    expect(() =>
      FinancialItem.create({ name: 'Item', quantity: 0.0000001 }),
    ).toThrow(RangeError);
  });

  it('rejects zero, negative and fractional prices', () => {
    for (const unitPriceCents of [0, -1, 10.5]) {
      expect(() =>
        FinancialItem.create({ name: 'Item', unitPriceCents }),
      ).toThrow(RangeError);
    }
  });

  it('derives the total using HALF_UP', () => {
    const item = FinancialItem.create({
      name: 'Item',
      quantity: 2.125,
      unitPriceCents: 1_999,
    });

    // 2.125 * 1999 = 4247.875 cents -> 4248
    expect(item.totalCents).toBe(4_248);
  });

  it('derives the total with sub-cent precision', () => {
    const belowHalf = FinancialItem.create({
      name: 'Item',
      quantity: 0.000001,
      unitPriceCents: 499_999,
    });
    const exactlyHalf = FinancialItem.create({
      name: 'Item',
      quantity: 0.000001,
      unitPriceCents: 500_000,
    });
    const aboveHalf = FinancialItem.create({
      name: 'Item',
      quantity: 0.000001,
      unitPriceCents: 500_001,
    });

    expect(belowHalf.totalCents).toBe(0);
    expect(exactlyHalf.totalCents).toBe(1);
    expect(aboveHalf.totalCents).toBe(1);
  });

  it('keeps the identity when rehydrated', () => {
    const item = FinancialItem.rehydrate({
      id: '8d5f4a52-3f0d-4a84-9a52-7daa8c1c5b64',
      name: 'Instalação',
      quantity: 2,
      unit: 'un',
      unitPriceCents: 5_000,
    });

    expect(item.id).toBe('8d5f4a52-3f0d-4a84-9a52-7daa8c1c5b64');
    expect(item.totalCents).toBe(10_000);
  });

  it('generates a different identity for each new item', () => {
    const first = FinancialItem.create({ name: 'Item' });
    const second = FinancialItem.create({ name: 'Item' });

    expect(first.id).not.toBe(second.id);
  });
});
