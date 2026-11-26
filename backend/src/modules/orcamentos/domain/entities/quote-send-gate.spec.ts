import { describe, expect, it } from 'vitest';
import { QuoteValidationError } from '../errors/quote-domain.errors.js';
import { Discount } from '../value-objects/discount.js';
import { InstallationAddress } from '../value-objects/installation-address.js';
import { MONEY_MAX_CENTS } from '../value-objects/money.js';
import { QuoteNumber } from '../value-objects/quote-number.js';
import type { CreateCurtainInput } from './curtain.js';
import { Curtain } from './curtain.js';
import { FinancialItem } from './financial-item.js';
import type { CreateQuoteInput } from './quote.js';
import { Quote, QuoteStatus } from './quote.js';

const createdAt = new Date('2026-10-19T12:00:00.000Z');
const now = new Date('2026-10-20T12:00:00.000Z');

const curtainItems = new WeakMap<Curtain, FinancialItem[]>();

function validItem(): FinancialItem {
  return FinancialItem.create(
    { name: 'Tecido', quantity: 8.05, unitPriceCents: 3_000 },
    'fixture-quote',
  );
}

type CurtainFixture = CreateCurtainInput & { components?: FinancialItem[] };
function validCurtain(overrides: CurtainFixture = {}): Curtain {
  const { components = [validItem()], ...input } = overrides;
  const curtain = Curtain.create({
    room: 'Sala',
    material: 'Linho',
    openingWidth: 2,
    height: 2.7,
    ...input,
  });
  curtainItems.set(curtain, components);
  return curtain;
}

function validAddress(): InstallationAddress {
  return InstallationAddress.create({
    street: 'Rua das Flores',
    number: '123',
    neighborhood: 'Centro',
    city: 'São Paulo',
  }) as InstallationAddress;
}

type QuoteFixture = Partial<CreateQuoteInput> & {
  generalAddOns?: FinancialItem[];
};
function quoteWith(overrides: QuoteFixture = {}): Quote {
  const curtains = overrides.curtains ?? [validCurtain()];
  const { generalAddOns = [], ...input } = overrides;
  const base = Quote.create({
    quoteNumber: QuoteNumber.create(2026, 42),
    customerId: '6f2b9f2c-3b8c-4e4a-9f2e-1a2b3c4d5e6f',
    createdAt,
    installationAddress: validAddress(),
    curtains,
    financialItems: [],
    ...input,
  });
  const financialItems = [
    ...curtains.flatMap((curtain) =>
      (curtainItems.get(curtain) ?? []).map((item) =>
        FinancialItem.rehydrate({
          id: item.id,
          quoteId: base.id,
          curtainId: curtain.id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          unitPriceCents: item.unitPriceCents,
        }),
      ),
    ),
    ...generalAddOns.map((item) =>
      FinancialItem.rehydrate({
        id: item.id,
        quoteId: base.id,
        curtainId: null,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unitPriceCents: item.unitPriceCents,
      }),
    ),
  ];
  return Quote.rehydrate({
    id: base.id,
    quoteNumber: base.quoteNumber,
    customerId: base.customerId,
    status: base.status,
    installationAddress: base.installationAddress,
    curtains,
    financialItems,
    discount: base.discount,
    commercialAdjustmentCents: base.commercialAdjustmentCents,
    notes: base.notes,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    firstSentAt: null,
    validUntil: null,
    confirmedAt: null,
    productionStartedAt: null,
    scheduledInstallationAt: null,
    completedAt: null,
  });
}

function codes(quote: Quote): string[] {
  return quote.validateForSend().map((violation) => violation.code);
}

describe('Quote.validateForSend', () => {
  it('accepts a valid quote and allows it to be sent', () => {
    const quote = quoteWith();

    expect(quote.validateForSend()).toEqual([]);

    quote.markAsSent(now);

    expect(quote.status).toBe(QuoteStatus.SENT);
  });

  it('requires a complete installation address', () => {
    expect(codes(quoteWith({ installationAddress: null }))).toContain(
      'INSTALLATION_ADDRESS_INCOMPLETE',
    );
    expect(
      codes(
        quoteWith({
          installationAddress: InstallationAddress.create({
            street: 'Rua das Flores',
          }),
        }),
      ),
    ).toContain('INSTALLATION_ADDRESS_INCOMPLETE');
  });

  it('requires at least one curtain', () => {
    expect(codes(quoteWith({ curtains: [] }))).toContain('NO_CURTAINS');
  });

  it('requires a room', () => {
    expect(
      codes(quoteWith({ curtains: [validCurtain({ room: null })] })),
    ).toContain('CURTAIN_ROOM_REQUIRED');
  });

  it('requires a positive opening width', () => {
    expect(
      codes(quoteWith({ curtains: [validCurtain({ openingWidth: null })] })),
    ).toContain('CURTAIN_OPENING_WIDTH_INVALID');
    expect(
      codes(quoteWith({ curtains: [validCurtain({ openingWidth: 0 })] })),
    ).toContain('CURTAIN_OPENING_WIDTH_INVALID');
  });

  it('requires a positive height', () => {
    expect(
      codes(quoteWith({ curtains: [validCurtain({ height: null })] })),
    ).toContain('CURTAIN_HEIGHT_INVALID');
    expect(
      codes(quoteWith({ curtains: [validCurtain({ height: 0 })] })),
    ).toContain('CURTAIN_HEIGHT_INVALID');
  });

  it('accepts a zero border but rejects an absent border', () => {
    expect(
      codes(quoteWith({ curtains: [validCurtain({ borderValue: 0 })] })),
    ).toEqual([]);

    const quote = quoteWith();
    const curtain = quote.curtains[0];

    quote.applyPatch({
      curtains: [{ id: curtain.id, borderValue: null }],
    });

    expect(codes(quote)).toContain('CURTAIN_BORDER_INVALID');
  });

  it('requires a positive fabric factor', () => {
    expect(
      codes(quoteWith({ curtains: [validCurtain({ fabricFactor: 0 })] })),
    ).toContain('CURTAIN_FABRIC_FACTOR_INVALID');

    const quote = quoteWith();
    const curtain = quote.curtains[0];

    quote.applyPatch({
      curtains: [{ id: curtain.id, fabricFactor: null }],
    });

    expect(codes(quote)).toContain('CURTAIN_FABRIC_FACTOR_INVALID');
  });

  it('requires a material', () => {
    expect(
      codes(quoteWith({ curtains: [validCurtain({ material: null })] })),
    ).toContain('CURTAIN_MATERIAL_REQUIRED');
  });

  it('requires at least one complete component per curtain', () => {
    expect(
      codes(quoteWith({ curtains: [validCurtain({ components: [] })] })),
    ).toContain('CURTAIN_COMPONENT_REQUIRED');

    const incomplete = FinancialItem.create(
      {
        name: 'Tecido',
        quantity: 2,
      },
      'fixture-quote',
    );
    const violations = codes(
      quoteWith({ curtains: [validCurtain({ components: [incomplete] })] }),
    );

    expect(violations).toContain('CURTAIN_COMPONENT_REQUIRED');
    expect(violations).toContain('COMPONENT_INVALID');
  });

  it('rejects zero quantities or prices on rehydrated items', () => {
    const withoutQuantity = validCurtain({
      components: [
        FinancialItem.rehydrate({
          id: '0b9f4f4e-3d0c-4c81-b4a8-4d1d81a0f001',
          quoteId: 'fixture-quote',
          curtainId: null,
          name: 'Tecido',
          quantity: 0,
          unit: 'm',
          unitPriceCents: 1_000,
        }),
      ],
    });

    const withoutPrice = validCurtain({
      components: [
        FinancialItem.rehydrate({
          id: '0b9f4f4e-3d0c-4c81-b4a8-4d1d81a0f002',
          quoteId: 'fixture-quote',
          curtainId: null,
          name: 'Tecido',
          quantity: 1,
          unit: 'm',
          unitPriceCents: 0,
        }),
      ],
    });

    expect(codes(quoteWith({ curtains: [withoutQuantity] }))).toContain(
      'COMPONENT_INVALID',
    );
    expect(codes(quoteWith({ curtains: [withoutPrice] }))).toContain(
      'COMPONENT_INVALID',
    );
  });

  it('rejects incomplete general add-ons', () => {
    const incomplete = FinancialItem.create(
      {
        name: 'Frete',
        unitPriceCents: 5_000,
      },
      'fixture-quote',
    );

    expect(codes(quoteWith({ generalAddOns: [incomplete] }))).toContain(
      'GENERAL_ADD_ON_INVALID',
    );
  });

  it('rejects a fixed discount above the subtotal', () => {
    const quote = quoteWith({
      curtains: [
        validCurtain({
          components: [
            FinancialItem.create(
              {
                name: 'Tecido',
                quantity: 2,
                unitPriceCents: 5_000,
              },
              'fixture-quote',
            ),
          ],
        }),
      ],
      discount: Discount.fixedAmount(10_001),
    });

    expect(codes(quote)).toContain('DISCOUNT_EXCEEDS_SUBTOTAL');
    expect(codes(quote)).toContain('TOTAL_NOT_POSITIVE');
  });

  it('allows a fixed discount equal to the subtotal with a positive adjustment', () => {
    const quote = quoteWith({
      curtains: [
        validCurtain({
          components: [
            FinancialItem.create(
              {
                name: 'Tecido',
                quantity: 2,
                unitPriceCents: 5_000,
              },
              'fixture-quote',
            ),
          ],
        }),
      ],
      discount: Discount.fixedAmount(10_000),
      commercialAdjustmentCents: 100,
    });

    expect(quote.totalCents).toBe(100);
    expect(quote.validateForSend()).toEqual([]);
  });

  it('rejects a non-positive final total', () => {
    const quote = quoteWith({ discount: Discount.percentage(100) });

    expect(codes(quote)).toContain('TOTAL_NOT_POSITIVE');
  });

  it('reports TOTAL_OUT_OF_RANGE as the only send violation', () => {
    const overflow = FinancialItem.create(
      {
        name: 'Tecido',
        quantity: 999_999,
        unitPriceCents: MONEY_MAX_CENTS,
      },
      'fixture-quote',
    );
    const quote = quoteWith({
      curtains: [validCurtain({ components: [overflow] })],
    });

    expect(quote.validateForSend()).toEqual([
      {
        code: 'TOTAL_OUT_OF_RANGE',
        message: 'Quote totals must fit the supported monetary range',
      },
    ]);
  });

  it('reports multiple violations at once', () => {
    const violations = codes(
      quoteWith({ installationAddress: null, curtains: [] }),
    );

    expect(violations).toContain('INSTALLATION_ADDRESS_INCOMPLETE');
    expect(violations).toContain('NO_CURTAINS');
    expect(violations).toContain('TOTAL_NOT_POSITIVE');
  });

  it('throws QuoteValidationError with the violations and keeps DRAFT', () => {
    const quote = quoteWith({ installationAddress: null });

    try {
      quote.markAsSent(now);

      throw new Error('markAsSent should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(QuoteValidationError);
      expect((error as QuoteValidationError).violations).toContainEqual(
        expect.objectContaining({ code: 'INSTALLATION_ADDRESS_INCOMPLETE' }),
      );
    }

    expect(quote.status).toBe(QuoteStatus.DRAFT);
  });

  it('does not change status when only validating', () => {
    const quote = quoteWith();

    quote.validateForSend();

    expect(quote.status).toBe(QuoteStatus.DRAFT);
  });
});
