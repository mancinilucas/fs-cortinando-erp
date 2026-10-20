import { describe, expect, it } from 'vitest';
import { Curtain } from './curtain.js';
import { FinancialItem } from './financial-item.js';

describe('Curtain', () => {
  it('applies the domain defaults on creation', () => {
    const curtain = Curtain.create({});

    expect(curtain.borderValue).toBe(0.15);
    expect(curtain.fabricFactor).toBe(3.5);
    expect(curtain.sequence).toBe(1);
    expect(curtain.openingWidth).toBeNull();
    expect(curtain.height).toBeNull();
    expect(curtain.room).toBeNull();
    expect(curtain.components).toEqual([]);
    expect(curtain.finalWidth).toBeNull();
    expect(curtain.fabricQuantity).toBeNull();
    expect(curtain.financialTotalCents).toBe(0);
  });

  it('keeps custom values and normalizes optional text', () => {
    const curtain = Curtain.create({
      sequence: 3,
      room: ' Sala ',
      description: '  Cortina blackout ',
      material: ' Linho ',
      openingWidth: 2.5,
      borderValue: 0.2,
      height: 2.8,
      fabricFactor: 2.8,
      notes: '   ',
    });

    expect(curtain.sequence).toBe(3);
    expect(curtain.room).toBe('Sala');
    expect(curtain.description).toBe('Cortina blackout');
    expect(curtain.material).toBe('Linho');
    expect(curtain.openingWidth).toBe(2.5);
    expect(curtain.borderValue).toBe(0.2);
    expect(curtain.height).toBe(2.8);
    expect(curtain.fabricFactor).toBe(2.8);
    expect(curtain.notes).toBeNull();
  });

  it('calculates the final width symmetrically', () => {
    const curtain = Curtain.create({ openingWidth: 2.001 });

    expect(curtain.finalWidth).toBe(2.301);
  });

  it('allows a zero border', () => {
    const curtain = Curtain.create({ openingWidth: 1.234, borderValue: 0 });

    expect(curtain.borderValue).toBe(0);
    expect(curtain.finalWidth).toBe(1.234);
  });

  it('calculates the fabric quantity with six decimal places', () => {
    const curtain = Curtain.create({
      openingWidth: 2.001,
      borderValue: 0.15,
      fabricFactor: 3.333,
    });

    expect(curtain.finalWidth).toBe(2.301);
    expect(curtain.fabricQuantity).toBe(7.669233);
  });

  it('does not use height in the fabric quantity', () => {
    const lower = Curtain.create({
      openingWidth: 2,
      height: 2,
      fabricFactor: 3.5,
    });
    const taller = Curtain.create({
      openingWidth: 2,
      height: 3,
      fabricFactor: 3.5,
    });

    expect(lower.fabricQuantity).toBe(8.05);
    expect(taller.fabricQuantity).toBe(8.05);
    expect(lower.fabricQuantity).toBe(taller.fabricQuantity);
  });

  it('sums the financial components', () => {
    const curtain = Curtain.create({
      components: [
        FinancialItem.create({
          name: 'Tecido',
          quantity: 8.05,
          unitPriceCents: 3_000,
        }),
        FinancialItem.create({
          name: 'Mão de obra',
          quantity: 8.05,
          unitPriceCents: 3_000,
        }),
      ],
    });

    expect(curtain.financialTotalCents).toBe(48_300);
  });

  it('ignores incomplete components while the quote is a draft', () => {
    const curtain = Curtain.create({
      components: [
        FinancialItem.create({
          name: 'Tecido',
          quantity: 2,
          unitPriceCents: 1_500,
        }),
        FinancialItem.create({ name: 'Mão de obra' }),
      ],
    });

    expect(curtain.financialTotalCents).toBe(3_000);
  });

  it('rejects negative measures', () => {
    expect(() => Curtain.create({ openingWidth: -1 })).toThrow(RangeError);
    expect(() => Curtain.create({ height: -1 })).toThrow(RangeError);
    expect(() => Curtain.create({ borderValue: -0.001 })).toThrow(RangeError);
    expect(() => Curtain.create({ fabricFactor: -1 })).toThrow(RangeError);
  });

  it('rejects measures with more than three decimal places', () => {
    expect(() => Curtain.create({ openingWidth: 1.0001 })).toThrow(RangeError);
    expect(() => Curtain.create({ borderValue: 0.1501 })).toThrow(RangeError);
    expect(() => Curtain.create({ fabricFactor: 3.5001 })).toThrow(RangeError);
  });

  it('rejects measures outside the persisted range', () => {
    expect(() => Curtain.create({ openingWidth: 1_000_000 })).toThrow(
      RangeError,
    );
    expect(() => Curtain.create({ borderValue: 1_000 })).toThrow(RangeError);
    expect(() => Curtain.create({ fabricFactor: 1_000 })).toThrow(RangeError);
  });

  it('rejects an invalid sequence', () => {
    expect(() => Curtain.create({ sequence: 0 })).toThrow(RangeError);
    expect(() => Curtain.create({ sequence: -1 })).toThrow(RangeError);
    expect(() => Curtain.create({ sequence: 1.5 })).toThrow(RangeError);
  });

  it('keeps identity and components when rehydrated', () => {
    const component = FinancialItem.rehydrate({
      id: '0b9f4f4e-3d0c-4c81-b4a8-4d1d81a0f001',
      name: 'Tecido',
      quantity: 2,
      unit: 'm',
      unitPriceCents: 1_000,
    });
    const curtain = Curtain.rehydrate({
      id: '1a0e9c6e-7b2f-4f0a-8b5e-3d3f2c1b0a99',
      sequence: 2,
      room: 'Sala',
      description: null,
      material: 'Linho',
      openingWidth: 2,
      borderValue: 0.15,
      height: 2.7,
      fabricFactor: 3.5,
      notes: null,
      components: [component],
    });

    expect(curtain.id).toBe('1a0e9c6e-7b2f-4f0a-8b5e-3d3f2c1b0a99');
    expect(curtain.sequence).toBe(2);
    expect(curtain.components).toHaveLength(1);
    expect(curtain.components[0]).toBe(component);
    expect(curtain.financialTotalCents).toBe(2_000);
  });

  it('generates a different identity for each new curtain', () => {
    expect(Curtain.create({}).id).not.toBe(Curtain.create({}).id);
  });
});
