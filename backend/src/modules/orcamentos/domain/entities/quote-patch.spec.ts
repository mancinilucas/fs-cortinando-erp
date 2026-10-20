import { describe, expect, it } from 'vitest';
import { Curtain, type CurtainPatch } from './curtain.js';
import { FinancialItem } from './financial-item.js';
import type { QuotePatch } from './quote.js';
import { Quote, QuoteStatus } from './quote.js';
import {
  QuoteNotEditableError,
  UnknownQuoteItemError,
} from '../errors/quote-domain.errors.js';
import { Discount } from '../value-objects/discount.js';
import { QuoteNumber } from '../value-objects/quote-number.js';

const createdAt = new Date('2026-10-19T12:00:00.000Z');

function item(
  name: string,
  quantity: number | null,
  unitPriceCents: number | null,
): FinancialItem {
  return FinancialItem.create({ name, quantity, unitPriceCents });
}

function curtain(overrides: CurtainPatch = {}): Curtain {
  return Curtain.create(overrides);
}

function quoteWith(
  overrides: {
    curtains?: Curtain[];
    generalAddOns?: FinancialItem[];
  } = {},
): Quote {
  return Quote.create({
    quoteNumber: QuoteNumber.create(2026, 42),
    customerId: '6f2b9f2c-3b8c-4e4a-9f2e-1a2b3c4d5e6f',
    createdAt,
    ...overrides,
  });
}

describe('Quote.applyPatch', () => {
  it('changes only notes when the patch contains only notes', () => {
    const curtains = [curtain({ room: 'Sala' }), curtain({ room: 'Quarto' })];
    const addOns = [item('Frete', 1, 5_000)];
    const quote = quoteWith({ curtains, generalAddOns: addOns });
    const curtainsReference = quote.curtains;
    const addOnsReference = quote.generalAddOns;

    quote.applyPatch({ notes: '  Ajuste comercial ' });

    expect(quote.notes).toBe('Ajuste comercial');
    expect(quote.curtains).toBe(curtainsReference);
    expect(quote.curtains).toEqual(curtains);
    expect(quote.generalAddOns).toBe(addOnsReference);
    expect(quote.generalAddOns).toEqual(addOns);
  });

  it('keeps an omitted collection unchanged', () => {
    const first = curtain({ room: 'Sala' });
    const second = curtain({ room: 'Quarto' });
    const quote = quoteWith({ curtains: [first, second] });

    quote.applyPatch({ discount: Discount.percentage(5) });

    expect(quote.curtains).toEqual([first, second]);
    expect(quote.curtains[0]).toBe(first);
    expect(quote.curtains[1]).toBe(second);
  });

  it('removes children when an empty collection is sent', () => {
    const quote = quoteWith({
      curtains: [curtain({ room: 'Sala' })],
      generalAddOns: [item('Frete', 1, 5_000)],
    });

    quote.applyPatch({ curtains: [], generalAddOns: [] });

    expect(quote.curtains).toEqual([]);
    expect(quote.generalAddOns).toEqual([]);
  });

  it('updates a curtain by id and preserves its identity', () => {
    const original = curtain({
      room: 'Sala',
      material: 'Linho',
      openingWidth: 2,
    });
    const quote = quoteWith({ curtains: [original] });

    quote.applyPatch({
      curtains: [{ id: original.id, room: 'Quarto', openingWidth: 2.5 }],
    });

    expect(quote.curtains).toHaveLength(1);
    expect(quote.curtains[0]).toBe(original);
    expect(quote.curtains[0].id).toBe(original.id);
    expect(quote.curtains[0].room).toBe('Quarto');
    expect(quote.curtains[0].material).toBe('Linho');
    expect(quote.curtains[0].openingWidth).toBe(2.5);
  });

  it('updates a component by id and preserves its identity', () => {
    const component = item('Tecido', 2, 1_000);
    const original = curtain({ components: [component] });
    const quote = quoteWith({ curtains: [original] });

    quote.applyPatch({
      curtains: [
        {
          id: original.id,
          components: [{ id: component.id, quantity: 3 }],
        },
      ],
    });

    expect(original.components).toHaveLength(1);
    expect(original.components[0]).toBe(component);
    expect(component.quantity).toBe(3);
    expect(component.name).toBe('Tecido');
    expect(component.unitPriceCents).toBe(1_000);
  });

  it('updates a general add-on by id and preserves its identity', () => {
    const addOn = item('Frete', 1, 5_000);
    const quote = quoteWith({ generalAddOns: [addOn] });

    quote.applyPatch({
      generalAddOns: [{ id: addOn.id, unitPriceCents: 6_000 }],
    });

    expect(quote.generalAddOns[0]).toBe(addOn);
    expect(addOn.unitPriceCents).toBe(6_000);
    expect(addOn.quantity).toBe(1);
  });

  it('creates a curtain without id with its own UUID', () => {
    const existing = curtain({ room: 'Sala' });
    const quote = quoteWith({ curtains: [existing] });

    quote.applyPatch({
      curtains: [{ id: existing.id }, { room: 'Cozinha' }],
    });

    expect(quote.curtains).toHaveLength(2);
    expect(quote.curtains[0]).toBe(existing);
    expect(quote.curtains[1].room).toBe('Cozinha');
    expect(quote.curtains[1].id).not.toBe(existing.id);
  });

  it('creates components and general add-ons without id', () => {
    const original = curtain({ room: 'Sala' });
    const quote = quoteWith({ curtains: [original] });

    quote.applyPatch({
      curtains: [
        {
          id: original.id,
          components: [{ name: 'Tecido', quantity: 2, unitPriceCents: 1_000 }],
        },
      ],
      generalAddOns: [{ name: 'Frete', quantity: 1, unitPriceCents: 5_000 }],
    });

    expect(original.components).toHaveLength(1);
    expect(original.components[0].name).toBe('Tecido');
    expect(original.components[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(quote.generalAddOns).toHaveLength(1);
    expect(quote.generalAddOns[0].name).toBe('Frete');
  });

  it('removes existing children omitted from a sent collection', () => {
    const kept = curtain({ room: 'Sala' });
    const removed = curtain({ room: 'Quarto' });
    const quote = quoteWith({ curtains: [kept, removed] });

    quote.applyPatch({ curtains: [{ id: kept.id }] });

    expect(quote.curtains).toEqual([kept]);
  });

  it('removes components omitted from a sent components collection', () => {
    const kept = item('Tecido', 2, 1_000);
    const removed = item('Trilho', 1, 5_000);
    const original = curtain({ components: [kept, removed] });
    const quote = quoteWith({ curtains: [original] });

    quote.applyPatch({
      curtains: [{ id: original.id, components: [{ id: kept.id }] }],
    });

    expect(original.components).toEqual([kept]);
  });

  it('reorders curtains and recalculates the sequence', () => {
    const first = curtain({ room: 'Sala' });
    const second = curtain({ room: 'Quarto' });
    const third = curtain({ room: 'Cozinha' });
    const quote = quoteWith({ curtains: [first, second, third] });

    quote.applyPatch({
      curtains: [{ id: third.id }, { id: first.id }, { id: second.id }],
    });

    expect(quote.curtains).toEqual([third, first, second]);
    expect(quote.curtains.map((entry) => entry.sequence)).toEqual([1, 2, 3]);
  });

  it('rejects unknown curtain ids', () => {
    const quote = quoteWith({ curtains: [curtain({ room: 'Sala' })] });

    expect(() =>
      quote.applyPatch({
        curtains: [{ id: '00000000-0000-4000-8000-000000000000' }],
      }),
    ).toThrow(UnknownQuoteItemError);
  });

  it('rejects an id that belongs to another quote', () => {
    const foreignCurtain = curtain({ room: 'Outro orçamento' });
    const foreignComponent = item('Tecido', 1, 1_000);
    foreignCurtain.components = [foreignComponent];

    const quote = quoteWith({ curtains: [curtain({ room: 'Sala' })] });

    expect(() =>
      quote.applyPatch({ curtains: [{ id: foreignCurtain.id }] }),
    ).toThrow(UnknownQuoteItemError);

    const local = quote.curtains[0];

    expect(() =>
      quote.applyPatch({
        curtains: [{ id: local.id, components: [{ id: foreignComponent.id }] }],
      }),
    ).toThrow(UnknownQuoteItemError);
  });

  it('rejects a component id that belongs to another curtain', () => {
    const first = curtain({
      room: 'Sala',
      components: [item('Tecido', 1, 1_000)],
    });
    const second = curtain({ room: 'Quarto' });
    const quote = quoteWith({ curtains: [first, second] });

    expect(() =>
      quote.applyPatch({
        curtains: [
          { id: first.id },
          {
            id: second.id,
            components: [{ id: first.components[0].id, quantity: 2 }],
          },
        ],
      }),
    ).toThrow(UnknownQuoteItemError);
  });

  it('rejects unknown and duplicated ids in a sent collection', () => {
    const addOn = item('Frete', 1, 5_000);
    const quote = quoteWith({ generalAddOns: [addOn] });

    expect(() =>
      quote.applyPatch({
        generalAddOns: [{ id: '00000000-0000-4000-8000-000000000000' }],
      }),
    ).toThrow(UnknownQuoteItemError);

    expect(() =>
      quote.applyPatch({
        generalAddOns: [{ id: addOn.id }, { id: addOn.id }],
      }),
    ).toThrow(UnknownQuoteItemError);

    expect(quote.generalAddOns).toEqual([addOn]);
  });

  it('rejects duplicated curtain ids without duplicating children', () => {
    const original = curtain({ room: 'Sala' });
    const quote = quoteWith({ curtains: [original] });

    expect(() =>
      quote.applyPatch({
        curtains: [{ id: original.id }, { id: original.id }],
      }),
    ).toThrow(UnknownQuoteItemError);

    expect(quote.curtains).toEqual([original]);
  });

  it('rejects ids on components of a new curtain', () => {
    const quote = quoteWith();

    expect(() =>
      quote.applyPatch({
        curtains: [
          {
            room: 'Sala',
            components: [
              { id: '00000000-0000-4000-8000-000000000000', name: 'Tecido' },
            ],
          },
        ],
      }),
    ).toThrow(UnknownQuoteItemError);
  });

  it('applies scalar field rules through the patch', () => {
    const quote = quoteWith();

    quote.applyPatch({
      notes: 'Original',
      discount: Discount.percentage(10),
      commercialAdjustmentCents: 500,
    });
    quote.applyPatch({ notes: null, commercialAdjustmentCents: 0 });

    expect(quote.notes).toBeNull();
    expect(quote.discount.equals(Discount.percentage(10))).toBe(true);
    expect(quote.commercialAdjustmentCents).toBeNull();
  });

  it('does not change customerId, quoteNumber or status', () => {
    const quote = quoteWith();
    const customerId = quote.customerId;
    const quoteNumber = quote.quoteNumber;

    quote.applyPatch({
      notes: 'Alterado',
      customerId: '00000000-0000-4000-8000-000000000000',
      status: QuoteStatus.CANCELLED,
    } as QuotePatch);

    expect(quote.customerId).toBe(customerId);
    expect(quote.quoteNumber).toBe(quoteNumber);
    expect(quote.status).toBe(QuoteStatus.DRAFT);
  });

  it('allows patches in DRAFT and SENT but not in other statuses', () => {
    const draft = quoteWith();
    draft.applyPatch({ notes: 'draft' });

    const sent = quoteWith();
    sent.status = QuoteStatus.SENT;
    sent.applyPatch({ notes: 'sent' });

    for (const status of [
      QuoteStatus.CONFIRMED,
      QuoteStatus.IN_PRODUCTION,
      QuoteStatus.COMPLETED,
      QuoteStatus.CANCELLED,
    ]) {
      const quote = quoteWith();
      quote.status = status;

      expect(() => quote.applyPatch({ notes: 'blocked' })).toThrow(
        QuoteNotEditableError,
      );
      expect(quote.notes).toBeNull();
    }
  });
});
