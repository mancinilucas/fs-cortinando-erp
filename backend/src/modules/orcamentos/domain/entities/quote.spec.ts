import { describe, expect, it } from 'vitest';
import { Curtain } from './curtain.js';
import { FinancialItem } from './financial-item.js';
import type { CreateQuoteInput } from './quote.js';
import { Quote, QuoteStatus } from './quote.js';
import { Discount } from '../value-objects/discount.js';
import { InstallationAddress } from '../value-objects/installation-address.js';
import { QuoteNumber } from '../value-objects/quote-number.js';

const createdAt = new Date('2026-10-19T12:00:00.000Z');

function item(
  name: string,
  quantity: number,
  unitPriceCents: number,
): FinancialItem {
  return FinancialItem.create({ name, quantity, unitPriceCents });
}

function curtainWith(items: FinancialItem[]): Curtain {
  return Curtain.create({ components: items });
}

function createQuote(overrides: Partial<CreateQuoteInput> = {}): Quote {
  return Quote.create({
    quoteNumber: QuoteNumber.create(2026, 42),
    customerId: '6f2b9f2c-3b8c-4e4a-9f2e-1a2b3c4d5e6f',
    createdAt,
    ...overrides,
  });
}

describe('Quote', () => {
  it('creates a DRAFT quote', () => {
    const address = InstallationAddress.create({
      street: 'Rua das Flores',
      number: '123',
      neighborhood: 'Centro',
      city: 'São Paulo',
    });
    const quote = createQuote({
      installationAddress: address,
      notes: '  Primeiro orçamento ',
    });

    expect(quote.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(quote.quoteNumber.value).toBe('ORÇ-2026-042');
    expect(quote.customerId).toBe('6f2b9f2c-3b8c-4e4a-9f2e-1a2b3c4d5e6f');
    expect(quote.status).toBe(QuoteStatus.DRAFT);
    expect(quote.installationAddress).toBe(address);
    expect(quote.notes).toBe('Primeiro orçamento');
    expect(quote.discount.equals(Discount.noDiscount())).toBe(true);
    expect(quote.commercialAdjustmentCents).toBeNull();
    expect(quote.createdAt).toBe(createdAt);
    expect(quote.updatedAt).toBe(createdAt);
    expect(quote.firstSentAt).toBeNull();
    expect(quote.validUntil).toBeNull();
    expect(quote.confirmedAt).toBeNull();
    expect(quote.productionStartedAt).toBeNull();
    expect(quote.scheduledInstallationAt).toBeNull();
    expect(quote.completedAt).toBeNull();
  });

  it('keeps customerId and quoteNumber immutable', () => {
    const quote = createQuote();

    quote.updateEditableData({ notes: 'Alterado' });

    expect(quote.customerId).toBe('6f2b9f2c-3b8c-4e4a-9f2e-1a2b3c4d5e6f');
    expect(quote.quoteNumber.value).toBe('ORÇ-2026-042');
  });

  it('calculates the totals in the documented order', () => {
    const quote = createQuote({
      curtains: [
        curtainWith([
          item('Tecido', 8.05, 3_000),
          item('Mão de obra', 8.05, 3_000),
        ]),
        curtainWith([item('Trilho', 2.5, 5_000)]),
      ],
      generalAddOns: [item('Frete', 1, 10_000)],
      discount: Discount.percentage(10),
      commercialAdjustmentCents: -1_000,
    });

    expect(quote.curtainsSubtotalCents).toBe(60_800);
    expect(quote.generalAddOnsSubtotalCents).toBe(10_000);
    expect(quote.subtotalCents).toBe(70_800);
    expect(quote.discountValueCents).toBe(7_080);
    expect(quote.calculatedTotalCents).toBe(63_720);
    expect(quote.effectiveCommercialAdjustmentCents).toBe(-1_000);
    expect(quote.totalCents).toBe(62_720);
  });

  it('applies a fixed discount', () => {
    const quote = createQuote({
      curtains: [curtainWith([item('Tecido', 2, 5_000)])],
      discount: Discount.fixedAmount(2_500),
    });

    expect(quote.subtotalCents).toBe(10_000);
    expect(quote.discountValueCents).toBe(2_500);
    expect(quote.calculatedTotalCents).toBe(7_500);
    expect(quote.totalCents).toBe(7_500);
  });

  it('applies a positive commercial adjustment', () => {
    const quote = createQuote({
      curtains: [curtainWith([item('Tecido', 2, 5_000)])],
      commercialAdjustmentCents: 1_250,
    });

    expect(quote.calculatedTotalCents).toBe(10_000);
    expect(quote.totalCents).toBe(11_250);
  });

  it('applies a negative commercial adjustment', () => {
    const quote = createQuote({
      curtains: [curtainWith([item('Tecido', 2, 5_000)])],
      commercialAdjustmentCents: -1_250,
    });

    expect(quote.totalCents).toBe(8_750);
  });

  it('supports 100% discount with a positive adjustment', () => {
    const quote = createQuote({
      curtains: [curtainWith([item('Tecido', 1, 10_000)])],
      discount: Discount.percentage(100),
      commercialAdjustmentCents: 500,
    });

    expect(quote.discountValueCents).toBe(10_000);
    expect(quote.calculatedTotalCents).toBe(0);
    expect(quote.totalCents).toBe(500);
  });

  it('treats empty children as zero totals', () => {
    const quote = createQuote();

    expect(quote.curtains).toEqual([]);
    expect(quote.generalAddOns).toEqual([]);
    expect(quote.curtainsSubtotalCents).toBe(0);
    expect(quote.generalAddOnsSubtotalCents).toBe(0);
    expect(quote.subtotalCents).toBe(0);
    expect(quote.discountValueCents).toBe(0);
    expect(quote.calculatedTotalCents).toBe(0);
    expect(quote.totalCents).toBe(0);
  });

  it('normalizes curtain sequences to 1..N on creation', () => {
    const first = Curtain.create({ sequence: 7, room: 'Sala' });
    const second = Curtain.create({ sequence: 2, room: 'Quarto' });
    const third = Curtain.create({ sequence: 99, room: 'Cozinha' });

    const quote = createQuote({ curtains: [first, second, third] });

    expect(quote.curtains.map((curtain) => curtain.sequence)).toEqual([
      1, 2, 3,
    ]);
    expect(quote.curtains.map((curtain) => curtain.room)).toEqual([
      'Sala',
      'Quarto',
      'Cozinha',
    ]);
  });

  it('does not keep history inside the aggregate', () => {
    const quote = createQuote();

    expect('history' in quote).toBe(false);
    expect(Object.keys(quote)).not.toContain('history');
  });

  it('rehydrates persisted state without regenerating identity', () => {
    const component = FinancialItem.rehydrate({
      id: '0b9f4f4e-3d0c-4c81-b4a8-4d1d81a0f001',
      name: 'Tecido',
      quantity: 2,
      unit: 'm',
      unitPriceCents: 1_000,
    });
    const curtain = Curtain.rehydrate({
      id: '1a0e9c6e-7b2f-4f0a-8b5e-3d3f2c1b0a99',
      sequence: 5,
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
    const updatedAt = new Date('2026-10-20T12:00:00.000Z');
    const quote = Quote.rehydrate({
      id: 'dd3f2c1b-0a99-4e4a-9f2e-1a2b3c4d5e6f',
      quoteNumber: QuoteNumber.create(2026, 42),
      customerId: '6f2b9f2c-3b8c-4e4a-9f2e-1a2b3c4d5e6f',
      status: QuoteStatus.SENT,
      installationAddress: null,
      curtains: [curtain],
      generalAddOns: [],
      discount: Discount.noDiscount(),
      commercialAdjustmentCents: null,
      notes: null,
      createdAt,
      updatedAt,
      firstSentAt: updatedAt,
      validUntil: new Date('2026-11-19T12:00:00.000Z'),
      confirmedAt: null,
      productionStartedAt: null,
      scheduledInstallationAt: null,
      completedAt: null,
    });

    expect(quote.id).toBe('dd3f2c1b-0a99-4e4a-9f2e-1a2b3c4d5e6f');
    expect(quote.status).toBe(QuoteStatus.SENT);
    expect(quote.updatedAt).toBe(updatedAt);
    expect(quote.curtains[0]).toBe(curtain);
    expect(quote.curtains[0].sequence).toBe(5);
    expect(quote.curtains[0].components[0]).toBe(component);
    expect(quote.totalCents).toBe(2_000);
  });

  it('updates only the provided scalar fields', () => {
    const address = InstallationAddress.create({
      street: 'Rua das Flores',
      number: '123',
      neighborhood: 'Centro',
      city: 'São Paulo',
    });
    const curtain = curtainWith([item('Tecido', 2, 1_000)]);
    const quote = createQuote({
      installationAddress: address,
      curtains: [curtain],
      generalAddOns: [item('Frete', 1, 500)],
      discount: Discount.percentage(10),
      commercialAdjustmentCents: 700,
      notes: 'Original',
    });

    quote.updateEditableData({ notes: '  Atualizado  ' });

    expect(quote.notes).toBe('Atualizado');
    expect(quote.installationAddress).toBe(address);
    expect(quote.discount.equals(Discount.percentage(10))).toBe(true);
    expect(quote.commercialAdjustmentCents).toBe(700);
    expect(quote.curtains).toEqual([curtain]);
    expect(quote.generalAddOns).toHaveLength(1);
  });

  it('clears scalar fields with null and canonicalizes zero adjustment', () => {
    const quote = createQuote({
      installationAddress: InstallationAddress.create({ city: 'São Paulo' }),
      discount: Discount.fixedAmount(100),
      commercialAdjustmentCents: 700,
      notes: 'Original',
    });

    quote.updateEditableData({
      installationAddress: null,
      discount: null,
      commercialAdjustmentCents: 0,
      notes: null,
    });

    expect(quote.installationAddress).toBeNull();
    expect(quote.discount.equals(Discount.noDiscount())).toBe(true);
    expect(quote.commercialAdjustmentCents).toBeNull();
    expect(quote.notes).toBeNull();
  });

  it('rejects invalid adjustments and dates', () => {
    expect(() => createQuote({ commercialAdjustmentCents: 10.5 })).toThrow(
      RangeError,
    );
    expect(() => createQuote({ createdAt: new Date(Number.NaN) })).toThrow(
      RangeError,
    );
    expect(() =>
      createQuote().updateEditableData({ commercialAdjustmentCents: 0.5 }),
    ).toThrow(RangeError);
  });
});
