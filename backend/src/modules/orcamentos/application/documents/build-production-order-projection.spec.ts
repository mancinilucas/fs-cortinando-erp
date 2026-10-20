import { randomUUID } from 'node:crypto';
import { Curtain } from '../../domain/entities/curtain.js';
import { FinancialItem } from '../../domain/entities/financial-item.js';
import {
  Quote,
  QuoteStatus,
  type QuoteSnapshot,
} from '../../domain/entities/quote.js';
import { Discount } from '../../domain/value-objects/discount.js';
import { InstallationAddress } from '../../domain/value-objects/installation-address.js';
import { QuoteNumber } from '../../domain/value-objects/quote-number.js';
import { DocumentDataIncompleteError } from '../errors/document-data-incomplete.error.js';
import { toProductionOrderProjection } from './build-production-order-projection.js';

const NOW = new Date('2026-10-20T12:00:00.000Z');

function makeQuote(overrides: Partial<QuoteSnapshot> = {}): Quote {
  return Quote.rehydrate({
    id: randomUUID(),
    quoteNumber: QuoteNumber.create(2026, 1),
    customerId: randomUUID(),
    status: QuoteStatus.CONFIRMED,
    installationAddress: null,
    curtains: [],
    generalAddOns: [],
    discount: Discount.noDiscount(),
    commercialAdjustmentCents: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    firstSentAt: NOW,
    validUntil: new Date('2026-11-19T12:00:00.000Z'),
    confirmedAt: NOW,
    productionStartedAt: null,
    scheduledInstallationAt: null,
    completedAt: null,
    ...overrides,
  });
}

function makeCurtain(
  input: {
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
  } = {},
): Curtain {
  return Curtain.create({
    sequence: input.sequence ?? 1,
    room: input.room === undefined ? 'Sala' : input.room,
    description: input.description ?? null,
    material: input.material === undefined ? 'Linho' : input.material,
    openingWidth: input.openingWidth === undefined ? 2.6 : input.openingWidth,
    borderValue: input.borderValue === undefined ? 0.15 : input.borderValue,
    height: input.height === undefined ? 2.65 : input.height,
    fabricFactor: input.fabricFactor ?? 3.5,
    notes: input.notes ?? null,
    components: input.components ?? [],
  });
}

function build(quote: Quote) {
  return toProductionOrderProjection(quote);
}

describe('toProductionOrderProjection', () => {
  it('builds the quote number and one curtain block with its technical data', () => {
    const projection = build(makeQuote({ curtains: [makeCurtain()] }));

    expect(projection).toEqual({
      quoteNumber: 'ORÇ-2026-001',
      curtains: [
        {
          sequence: 1,
          room: 'Sala',
          material: 'Linho',
          finalWidth: 2.9,
          height: 2.65,
        },
      ],
    });
  });

  it('orders the curtain blocks by sequence', () => {
    const quote = makeQuote({
      curtains: [
        makeCurtain({ sequence: 3, room: 'Escritório' }),
        makeCurtain({ sequence: 1, room: 'Sala' }),
        makeCurtain({ sequence: 2, room: 'Quarto' }),
      ],
    });

    expect(build(quote).curtains.map((curtain) => curtain.sequence)).toEqual([
      1, 2, 3,
    ]);
    expect(build(quote).curtains.map((curtain) => curtain.room)).toEqual([
      'Sala',
      'Quarto',
      'Escritório',
    ]);
  });

  it('keeps the optional description when present and omits it when empty', () => {
    const quote = makeQuote({
      curtains: [
        makeCurtain({ description: 'Janela principal' }),
        makeCurtain({ description: null }),
        makeCurtain({ description: '   ' }),
      ],
    });

    const [withDescription, withoutDescription, whitespace] =
      build(quote).curtains;

    expect(withDescription).toHaveProperty('description', 'Janela principal');
    expect(withoutDescription).not.toHaveProperty('description');
    expect(whitespace).not.toHaveProperty('description');
  });

  it('uses the final width derived by the domain without recalculating it', () => {
    const curtain = makeCurtain({ openingWidth: 2.605, borderValue: 0.15 });

    const [projection] = build(makeQuote({ curtains: [curtain] })).curtains;

    expect(projection.finalWidth).toBe(curtain.finalWidth);
    expect(projection.finalWidth).toBe(2.905);
    expect(projection.finalWidth).not.toBe(curtain.openingWidth);
  });

  it('fails when a curtain has no room', () => {
    const quote = makeQuote({ curtains: [makeCurtain({ room: null })] });

    expect(() => build(quote)).toThrow(DocumentDataIncompleteError);
  });

  it('fails when room is blank', () => {
    const quote = makeQuote({ curtains: [makeCurtain({ room: '   ' })] });

    expect(() => build(quote)).toThrow(DocumentDataIncompleteError);
  });

  it('fails when a curtain has no material', () => {
    const quote = makeQuote({ curtains: [makeCurtain({ material: null })] });

    expect(() => build(quote)).toThrow(DocumentDataIncompleteError);
  });

  it('fails when a curtain has no height', () => {
    const quote = makeQuote({ curtains: [makeCurtain({ height: null })] });

    expect(() => build(quote)).toThrow(DocumentDataIncompleteError);
  });

  it('fails when the final width cannot be derived', () => {
    const withoutOpeningWidth = makeQuote({
      curtains: [makeCurtain({ openingWidth: null })],
    });
    // create() defaults a missing border, so the legacy null border is
    // represented through rehydration.
    const base = makeCurtain();
    const withoutBorderValue = makeQuote({
      curtains: [
        Curtain.rehydrate({
          id: base.id,
          sequence: base.sequence,
          room: base.room,
          description: base.description,
          material: base.material,
          openingWidth: base.openingWidth,
          borderValue: null,
          height: base.height,
          fabricFactor: base.fabricFactor,
          notes: base.notes,
          components: base.components,
        }),
      ],
    });

    expect(() => build(withoutOpeningWidth)).toThrow(
      DocumentDataIncompleteError,
    );
    expect(() => build(withoutBorderValue)).toThrow(
      DocumentDataIncompleteError,
    );
  });

  it('exposes only the authorized fields and no forbidden data', () => {
    const quote = makeQuote({
      installationAddress: InstallationAddress.create({
        street: 'SENTINELA-RUA',
        number: '123',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
      }),
      generalAddOns: [
        FinancialItem.create({
          name: 'SENTINELA-ADICIONAL',
          quantity: 1,
          unit: 'un',
          unitPriceCents: 20_000,
        }),
      ],
      discount: Discount.fixedAmount(5_000),
      commercialAdjustmentCents: 1_000,
      notes: 'SENTINELA-NOTA-INTERNA',
      curtains: [
        makeCurtain({
          notes: 'SENTINELA-NOTA-CORTINA',
          components: [
            FinancialItem.create({
              name: 'SENTINELA-COMPONENTE',
              quantity: 1,
              unit: 'un',
              unitPriceCents: 123_456,
            }),
          ],
        }),
      ],
    });

    const projection = build(quote);
    const curtain = projection.curtains[0];

    expect(Object.keys(projection).sort()).toEqual(['curtains', 'quoteNumber']);
    expect(Object.keys(curtain).sort()).toEqual([
      'finalWidth',
      'height',
      'material',
      'room',
      'sequence',
    ]);
    expect(curtain).not.toHaveProperty('id');
    expect(curtain).not.toHaveProperty('openingWidth');
    expect(curtain).not.toHaveProperty('borderValue');
    expect(curtain).not.toHaveProperty('fabricFactor');
    expect(curtain).not.toHaveProperty('fabricQuantity');
    expect(curtain).not.toHaveProperty('components');
    expect(curtain).not.toHaveProperty('notes');

    const serialized = JSON.stringify(projection);

    expect(serialized).not.toContain('SENTINELA');
    expect(serialized).not.toContain(quote.customerId);
    expect(serialized).not.toContain('123456');
  });
});
