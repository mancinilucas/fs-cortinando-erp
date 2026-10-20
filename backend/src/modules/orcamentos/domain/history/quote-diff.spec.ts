import { Curtain } from '../entities/curtain.js';
import { FinancialItem } from '../entities/financial-item.js';
import { Quote, type QuotePatch } from '../entities/quote.js';
import { QuoteNumber } from '../value-objects/quote-number.js';
import { captureEditableState, diffEditableState } from './quote-diff.js';
import type { QuoteEditChange } from './quote-history.js';

describe('quote diff', () => {
  function buildQuote(): {
    quote: Quote;
    sala: Curtain;
    quarto: Curtain;
    fabric: FinancialItem;
    labor: FinancialItem;
    addOn: FinancialItem;
  } {
    const fabric = FinancialItem.create({
      name: 'Tecido',
      quantity: 8.05,
      unit: 'm',
      unitPriceCents: 3_000,
    });
    const labor = FinancialItem.create({
      name: 'Mão de obra',
      quantity: 1,
      unitPriceCents: 20_000,
    });
    const sala = Curtain.create({
      room: 'Sala',
      material: 'Linho A',
      openingWidth: 2.6,
      borderValue: 0.15,
      height: 2.6,
      fabricFactor: 3.5,
      components: [fabric, labor],
    });
    const quarto = Curtain.create({ room: 'Quarto' });
    const addOn = FinancialItem.create({
      name: 'Frete',
      quantity: 1,
      unitPriceCents: 5_000,
    });
    const quote = Quote.create({
      quoteNumber: QuoteNumber.create(3_001, 1),
      customerId: 'customer-id',
      createdAt: new Date('2026-10-19T12:00:00.000Z'),
      curtains: [sala, quarto],
      generalAddOns: [addOn],
    });

    return { quote, sala, quarto, fabric, labor, addOn };
  }

  function diff(quote: Quote, patch: QuotePatch): QuoteEditChange[] {
    const before = captureEditableState(quote);

    quote.applyPatch(patch);

    return diffEditableState(before, captureEditableState(quote));
  }

  it('returns no changes for an empty or identical patch', () => {
    const { quote, sala, quarto, fabric, labor, addOn } = buildQuote();

    expect(diff(quote, {})).toEqual([]);
    expect(
      diff(quote, {
        notes: null,
        curtains: [
          {
            id: sala.id,
            room: 'Sala',
            material: 'Linho A',
            openingWidth: 2.6,
            borderValue: 0.15,
            height: 2.6,
            fabricFactor: 3.5,
            components: [
              {
                id: fabric.id,
                name: 'Tecido',
                quantity: 8.05,
                unit: 'm',
                unitPriceCents: 3_000,
              },
              {
                id: labor.id,
                name: 'Mão de obra',
                quantity: 1,
                unitPriceCents: 20_000,
              },
            ],
          },
          { id: quarto.id, room: 'Quarto' },
        ],
        generalAddOns: [
          {
            id: addOn.id,
            name: 'Frete',
            quantity: 1,
            unitPriceCents: 5_000,
          },
        ],
      }),
    ).toEqual([]);
  });

  it('records scalar changes after normalization', () => {
    const { quote } = buildQuote();

    expect(
      diff(quote, {
        notes: '  Instalação urgente  ',
        commercialAdjustmentCents: -500,
      }),
    ).toEqual([
      {
        field: 'commercialAdjustmentCents',
        previous: null,
        next: -500,
      },
      { field: 'notes', previous: null, next: 'Instalação urgente' },
    ]);
  });

  it('locates curtain and component field changes', () => {
    const { quote, sala, quarto, fabric, labor } = buildQuote();

    expect(
      diff(quote, {
        curtains: [
          {
            id: sala.id,
            height: 2.65,
            components: [{ id: fabric.id, name: 'Linho B' }, { id: labor.id }],
          },
          { id: quarto.id },
        ],
      }),
    ).toEqual([
      {
        field: 'height',
        previous: 2.6,
        next: 2.65,
        curtainSequence: 1,
        curtainRoom: 'Sala',
      },
      {
        field: 'name',
        previous: 'Tecido',
        next: 'Linho B',
        curtainSequence: 1,
        curtainRoom: 'Sala',
        componentName: 'Linho B',
      },
    ]);
  });

  it('records reordering as sequence changes', () => {
    const { quote, sala, quarto } = buildQuote();

    expect(
      diff(quote, { curtains: [{ id: quarto.id }, { id: sala.id }] }),
    ).toEqual([
      {
        field: 'sequence',
        previous: 2,
        next: 1,
        curtainSequence: 1,
        curtainRoom: 'Quarto',
      },
      {
        field: 'sequence',
        previous: 1,
        next: 2,
        curtainSequence: 2,
        curtainRoom: 'Sala',
      },
    ]);
  });

  it('records added and removed curtains and components', () => {
    const { quote, sala, fabric } = buildQuote();

    expect(
      diff(quote, {
        curtains: [
          { room: 'Cozinha' },
          { id: sala.id, components: [{ id: fabric.id }] },
        ],
      }),
    ).toEqual([
      {
        field: 'curtain',
        previous: null,
        next: 'Cozinha',
        curtainSequence: 1,
        curtainRoom: 'Cozinha',
      },
      {
        field: 'sequence',
        previous: 1,
        next: 2,
        curtainSequence: 2,
        curtainRoom: 'Sala',
      },
      {
        field: 'component',
        previous: 'Mão de obra',
        next: null,
        curtainSequence: 2,
        curtainRoom: 'Sala',
        componentName: 'Mão de obra',
      },
      {
        field: 'curtain',
        previous: 'Quarto',
        next: null,
        curtainSequence: 2,
        curtainRoom: 'Quarto',
      },
    ]);
  });

  it('records general add-on changes', () => {
    const { quote, addOn } = buildQuote();

    expect(
      diff(quote, {
        generalAddOns: [
          { id: addOn.id, quantity: 2 },
          { name: 'Montagem', quantity: 1, unitPriceCents: 10_000 },
        ],
      }),
    ).toEqual([
      { field: 'quantity', previous: 1, next: 2 },
      { field: 'generalAddOn', previous: null, next: 'Montagem' },
    ]);
  });

  it('records a cleared installation address field by field', () => {
    const { quote } = buildQuote();

    quote.applyPatch({
      installationAddress: { street: 'Rua Nova' },
    });

    const before = captureEditableState(quote);

    quote.applyPatch({ installationAddress: null });

    expect(diffEditableState(before, captureEditableState(quote))).toEqual([
      {
        field: 'installationAddress.street',
        previous: 'Rua Nova',
        next: null,
      },
    ]);
  });

  it('keeps the compared state independent from later mutations', () => {
    const { quote, sala } = buildQuote();
    const before = captureEditableState(quote);

    sala.room = 'Varanda';

    expect(captureEditableState(quote).curtains[0].room).toBe('Varanda');
    expect(before.curtains[0].room).toBe('Sala');
  });
});
