import {
  Curtain,
  DEFAULT_BORDER_VALUE,
  DEFAULT_FABRIC_FACTOR,
  type CreateCurtainInput,
} from './entities/curtain.js';
import {
  FinancialItem,
  reconcileFinancialItems,
  type FinancialItemInput,
} from './entities/financial-item.js';
import {
  Quote,
  QuoteStatus,
  type CreateQuoteInput,
  type QuoteSnapshot,
} from './entities/quote.js';
import {
  InvalidQuoteTransitionError,
  QuoteNotEditableError,
  QuoteValidationError,
  UnknownQuoteItemError,
} from './errors/quote-domain.errors.js';
import { QuoteHistoryDetails } from './history/quote-history.js';
import { Discount, DiscountType } from './value-objects/discount.js';
import { InstallationAddress } from './value-objects/installation-address.js';
import {
  MONEY_MAX_CENTS,
  MONEY_MIN_CENTS,
  Money,
  calculateItemTotalCents,
  divideHalfUp,
} from './value-objects/money.js';
import {
  calculateFabricQuantity,
  calculateFinalWidth,
  measureToMilli,
  quantityToMicro,
} from './value-objects/measurements.js';
import {
  QuoteNumber,
  commercialYearFrom,
  formatQuoteNumber,
} from './value-objects/quote-number.js';

// Consolidated domain regression suite (ORCAMENTO-41 / D121).
//
// Traceability matrix — decision → suite section:
//   D76  → aggregate boundary and creation
//   D77  → status enum values (state machine section) and English identifiers
//   D78  → customerId stored from first save; application gate in
//          create-quote-from-customer.use-case.spec.ts (ORCAMENTO-28)
//   D79  → aggregate creation (DRAFT, UUID, initial timestamps)
//   D80  → numbering counter is infrastructure (ORCAMENTO-42); value format below
//   D81  → QuoteNumber format, commercial year, padding
//   D82  → QuoteNumber value object
//   D83  → curtain identity and sequence
//   D84  → curtain defaults
//   D85  → curtain intrinsic calculations
//   D86  → measurements and exact integer arithmetic (Money)
//   D87  → FinancialItem validation and derived total
//   D88  → general add-ons and subtotal
//   D89  → labor preset is frontend-only; backend never creates items
//   D90  → Discount value object
//   D91  → discount monetary calculation
//   D92  → commercial adjustment
//   D93  → derived totals and per-item HALF_UP
//   D94  → installation address snapshot
//   D95  → partial address in draft
//   D96  → state machine
//   D97  → send gate
//   D98  → send dates and validity
//   D99  → confirmation
//   D100 → reopening
//   D101 → renewal
//   D102 → cancellation
//   D103 → production start
//   D104 → installation scheduling
//   D105 → service completion
//   D106 → derived expiration
//   D107 → derived late installation
//   D108 → history is not loaded with the aggregate (below); event
//          persistence/atomicity is infrastructure (ORCAMENTO-42)
//   D109 → history details builders
//   D110 → draft-only physical deletion guard
//   D111 → no soft delete (schema/integration, ORCAMENTO-42)
//   D112–D116, D118–D124 → application/infra/presentation; covered by their
//          own specs and the ORCAMENTO-42 integration suite; this suite stays
//          inside the domain layer
//   D117 → partial update semantics
//   D119, D120 → transaction and concurrency behavior (ORCAMENTO-42)

const CUSTOMER_ID = '7a4b2c9e-0000-4000-8000-000000000000';
const QUOTE_ID = '11111111-1111-4111-8111-111111111111';
const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999';
const CREATED_AT = new Date('2026-10-19T12:00:00.000Z');
const NOW = new Date('2026-10-20T12:00:00.000Z');
const LATER = new Date('2026-11-18T12:00:00.000Z');
const THIRTY_DAYS_AFTER_NOW = new Date(
  NOW.getTime() + 30 * 24 * 60 * 60 * 1000,
);

function number(sequence = 1): QuoteNumber {
  return QuoteNumber.create(2026, sequence);
}

function completeAddress(): InstallationAddress {
  const address = InstallationAddress.create({
    postalCode: '01310-100',
    street: ' Avenida Paulista ',
    number: '1000',
    complement: 'Apto 10',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'sp',
  });

  if (address === null) {
    throw new Error('Fixture address must be complete');
  }

  return address;
}

function item(overrides: Partial<FinancialItemInput> = {}): FinancialItem {
  return FinancialItem.create({
    name: 'Tecido',
    quantity: 8.05,
    unitPriceCents: 3_000,
    ...overrides,
  });
}

function curtain(overrides: Partial<CreateCurtainInput> = {}): Curtain {
  return Curtain.create({
    room: 'Sala',
    material: 'Linho',
    openingWidth: 2,
    height: 2.7,
    components: [item()],
    ...overrides,
  });
}

function draft(overrides: Partial<CreateQuoteInput> = {}): Quote {
  return Quote.create({
    quoteNumber: number(),
    customerId: CUSTOMER_ID,
    createdAt: CREATED_AT,
    installationAddress: completeAddress(),
    curtains: [curtain()],
    ...overrides,
  });
}

function rehydrated(overrides: Partial<QuoteSnapshot> = {}): Quote {
  return Quote.rehydrate({
    id: QUOTE_ID,
    quoteNumber: number(),
    customerId: CUSTOMER_ID,
    status: QuoteStatus.DRAFT,
    installationAddress: completeAddress(),
    curtains: [curtain()],
    generalAddOns: [],
    discount: Discount.noDiscount(),
    commercialAdjustmentCents: null,
    notes: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    firstSentAt: null,
    validUntil: null,
    confirmedAt: null,
    productionStartedAt: null,
    scheduledInstallationAt: null,
    completedAt: null,
    ...overrides,
  });
}

function sent(overrides: Partial<QuoteSnapshot> = {}): Quote {
  return rehydrated({
    status: QuoteStatus.SENT,
    firstSentAt: NOW,
    validUntil: LATER,
    ...overrides,
  });
}

function confirmed(overrides: Partial<QuoteSnapshot> = {}): Quote {
  return rehydrated({
    status: QuoteStatus.CONFIRMED,
    firstSentAt: NOW,
    validUntil: LATER,
    confirmedAt: NOW,
    ...overrides,
  });
}

function inProduction(overrides: Partial<QuoteSnapshot> = {}): Quote {
  return rehydrated({
    status: QuoteStatus.IN_PRODUCTION,
    firstSentAt: NOW,
    validUntil: LATER,
    confirmedAt: NOW,
    productionStartedAt: NOW,
    ...overrides,
  });
}

function violationCodes(quote: Quote): string[] {
  return quote.validateForSend().map((violation) => violation.code);
}

function expectRejected(operation: () => unknown): void {
  expect(operation).toThrow(InvalidQuoteTransitionError);
}

describe('QuoteNumber (D81/D82)', () => {
  it('formats the canonical number with three-digit padding', () => {
    expect(formatQuoteNumber(2026, 1)).toBe('ORÇ-2026-001');
    expect(formatQuoteNumber(2026, 42)).toBe('ORÇ-2026-042');
    expect(formatQuoteNumber(2026, 1_000)).toBe('ORÇ-2026-1000');
  });

  it('exposes year and sequence and compares by value', () => {
    const number = QuoteNumber.create(2026, 7);

    expect(number.value).toBe('ORÇ-2026-007');
    expect(number.year).toBe(2026);
    expect(number.sequence).toBe(7);
    expect(number.toString()).toBe('ORÇ-2026-007');
    expect(number.equals(QuoteNumber.create(2026, 7))).toBe(true);
    expect(number.equals(QuoteNumber.create(2026, 8))).toBe(false);
  });

  it('parses the canonical format only', () => {
    expect(QuoteNumber.parse('ORÇ-2026-001').sequence).toBe(1);
    expect(QuoteNumber.parse('ORÇ-2026-1000').year).toBe(2026);

    for (const invalid of [
      'ORC-2026-001',
      'orç-2026-001',
      'ORÇ-26-001',
      'ORÇ-2026-01',
      'ORÇ-2026-001 ',
      ' ORÇ-2026-001',
      'ORÇ-2026-000',
    ]) {
      expect(() => QuoteNumber.parse(invalid)).toThrow(Error);
    }
  });

  it('rejects years and sequences outside the supported range', () => {
    expect(() => QuoteNumber.create(0, 1)).toThrow(RangeError);
    expect(() => QuoteNumber.create(10_000, 1)).toThrow(RangeError);
    expect(() => QuoteNumber.create(2026.5, 1)).toThrow(RangeError);
    expect(() => QuoteNumber.create(2026, 0)).toThrow(RangeError);
    expect(() => QuoteNumber.create(2026, -1)).toThrow(RangeError);
    expect(() => QuoteNumber.create(2026, 1.5)).toThrow(RangeError);
    expect(() => QuoteNumber.create(2026, 2_147_483_648)).toThrow(RangeError);
    expect(QuoteNumber.create(2026, 2_147_483_647).value).toContain(
      '2147483647',
    );
  });

  it('derives the commercial year in America/Sao_Paulo', () => {
    // 2026-01-01T01:00Z is 2025-12-31T22:00 in São Paulo.
    expect(commercialYearFrom(new Date('2026-01-01T01:00:00.000Z'))).toBe(2025);
    // 2026-01-01T03:00Z is 2026-01-01T00:00 in São Paulo.
    expect(commercialYearFrom(new Date('2026-01-01T03:00:00.000Z'))).toBe(2026);
    expect(() => commercialYearFrom(new Date('invalid'))).toThrow(RangeError);
  });
});

describe('Money and exact arithmetic (D86)', () => {
  it('accepts the persisted 32-bit range and rejects anything outside it', () => {
    expect(Money.fromCents(MONEY_MIN_CENTS).cents).toBe(MONEY_MIN_CENTS);
    expect(Money.fromCents(MONEY_MAX_CENTS).cents).toBe(MONEY_MAX_CENTS);
    expect(() => Money.fromCents(MONEY_MAX_CENTS + 1)).toThrow(RangeError);
    expect(() => Money.fromCents(MONEY_MIN_CENTS - 1)).toThrow(RangeError);
    expect(() => Money.fromCents(1.5)).toThrow(RangeError);
    expect(() => Money.fromCents(Number.NaN)).toThrow(RangeError);
  });

  it('adds and subtracts exactly and guards the range', () => {
    expect(Money.zero().add(Money.fromCents(1_500)).cents).toBe(1_500);
    expect(Money.fromCents(1_500).subtract(Money.fromCents(500)).cents).toBe(
      1_000,
    );
    expect(() =>
      Money.fromCents(MONEY_MAX_CENTS).add(Money.fromCents(1)),
    ).toThrow(RangeError);
    expect(() =>
      Money.fromCents(MONEY_MIN_CENTS).subtract(Money.fromCents(1)),
    ).toThrow(RangeError);
  });

  it('rounds HALF_UP, including ties and negative numerators', () => {
    expect(divideHalfUp(5n, 10n)).toBe(1n);
    expect(divideHalfUp(4n, 10n)).toBe(0n);
    expect(divideHalfUp(15n, 10n)).toBe(2n);
    expect(divideHalfUp(-5n, 10n)).toBe(-1n);
    expect(() => divideHalfUp(1n, 0n)).toThrow(RangeError);
    expect(() => divideHalfUp(1n, -1n)).toThrow(RangeError);
  });

  it('computes item totals as HALF_UP(quantityMicro × price / 1e6)', () => {
    expect(calculateItemTotalCents(8_050_000, 3_000)).toBe(24_150);
    expect(calculateItemTotalCents(500_000, 1)).toBe(1);
    expect(calculateItemTotalCents(500_000, 3)).toBe(2);
    expect(calculateItemTotalCents(333_333, 100)).toBe(33);
    expect(() => calculateItemTotalCents(1.5, 100)).toThrow(RangeError);
    expect(() =>
      calculateItemTotalCents(999_999_999_999, MONEY_MAX_CENTS),
    ).toThrow(RangeError);
  });
});

describe('measurements (D85/D86)', () => {
  it('converts meters to milli and quantities to micro', () => {
    expect(measureToMilli(2.3, 'measure')).toBe(2_300);
    expect(measureToMilli(0.001, 'measure')).toBe(1);
    expect(quantityToMicro(8.05, 'quantity')).toBe(8_050_000);
    expect(quantityToMicro(0.000001, 'quantity')).toBe(1);
  });

  it('rejects negative, non-finite and over-precise values', () => {
    expect(() => measureToMilli(-1, 'measure')).toThrow(RangeError);
    expect(() => measureToMilli(Number.POSITIVE_INFINITY, 'measure')).toThrow(
      RangeError,
    );
    expect(() => measureToMilli(1.2345, 'measure')).toThrow(RangeError);
    expect(() => quantityToMicro(0.0000001, 'quantity')).toThrow(RangeError);
  });

  it('derives final width and fabric quantity without floating point drift', () => {
    expect(calculateFinalWidth(2, 0.15)).toBe(2.3);
    expect(calculateFinalWidth(999_999.999, 999.999)).toBe(1_001_999.997);
    expect(calculateFabricQuantity(2.3, 3.5)).toBe(8.05);
    expect(calculateFabricQuantity(2, 3.5)).toBe(7);
  });

  it('keeps height out of both formulas', () => {
    const low = curtain({ height: 1 });
    const high = curtain({ height: 10 });

    expect(low.finalWidth).toBe(high.finalWidth);
    expect(low.fabricQuantity).toBe(high.fabricQuantity);
  });
});

describe('InstallationAddress (D94/D95)', () => {
  it('normalizes a copied snapshot', () => {
    const address = InstallationAddress.create({
      postalCode: '01310-100',
      street: '  Avenida Paulista ',
      number: ' 1000 ',
      complement: '  ',
      neighborhood: 'Bela Vista',
      city: ' São Paulo ',
      state: ' sp ',
    });

    expect(address).not.toBeNull();
    expect(address?.postalCode).toBe('01310100');
    expect(address?.street).toBe('Avenida Paulista');
    expect(address?.number).toBe('1000');
    expect(address?.complement).toBeNull();
    expect(address?.city).toBe('São Paulo');
    expect(address?.state).toBe('SP');
  });

  it('treats absent and blank addresses as null', () => {
    expect(InstallationAddress.create(null)).toBeNull();
    expect(InstallationAddress.create(undefined)).toBeNull();
    expect(InstallationAddress.create({})).toBeNull();
    expect(
      InstallationAddress.create({ street: '  ', city: '   ', state: ' ' }),
    ).toBeNull();
    expect(InstallationAddress.create({ postalCode: 'abc' })).toBeNull();
  });

  it('requires street, number, neighborhood and city for completeness', () => {
    const partial = InstallationAddress.create({ street: 'Rua A', city: 'SP' });

    expect(partial?.isComplete()).toBe(false);

    const complete = completeAddress();

    expect(complete.isComplete()).toBe(true);
    expect(
      InstallationAddress.create({
        street: 'Rua A',
        number: '1',
        neighborhood: 'Centro',
        city: 'SP',
      })?.isComplete(),
    ).toBe(true);
  });

  it('rejects malformed postal code and state', () => {
    expect(() => InstallationAddress.create({ postalCode: '123' })).toThrow(
      RangeError,
    );
    expect(() => InstallationAddress.create({ state: 'São Paulo' })).toThrow(
      RangeError,
    );
  });

  it('compares snapshots by value', () => {
    const address = completeAddress();

    expect(address.equals(completeAddress())).toBe(true);
    expect(address.equals(null)).toBe(false);
    expect(
      address.equals(
        InstallationAddress.create({
          street: 'Outra',
          city: 'SP',
          number: '1',
          neighborhood: 'X',
        }),
      ),
    ).toBe(false);
  });

  it('keeps partial fields in a draft (D95)', () => {
    const quote = draft({
      installationAddress: InstallationAddress.create({
        street: 'Rua A',
        complement: 'Fundos',
      }),
    });

    expect(quote.installationAddress?.street).toBe('Rua A');
    expect(quote.installationAddress?.complement).toBe('Fundos');
    expect(quote.installationAddress?.isComplete()).toBe(false);
    expect(quote.validateForSend().map((entry) => entry.code)).toContain(
      'INSTALLATION_ADDRESS_INCOMPLETE',
    );
  });
});

describe('Discount (D90/D91)', () => {
  it('builds the three supported shapes', () => {
    expect(Discount.noDiscount().type).toBe(DiscountType.NO_DISCOUNT);
    expect(Discount.percentage(12.34).percentage).toBe(12.34);
    expect(Discount.percentage(12.34).percentageHundredths).toBe(1_234);
    expect(Discount.fixedAmount(500).fixedAmountCents).toBe(500);
  });

  it('validates percentage bounds and scale', () => {
    expect(Discount.percentage(100).percentage).toBe(100);
    expect(Discount.percentage(0.01).percentageHundredths).toBe(1);

    for (const invalid of [
      0,
      -1,
      100.01,
      12.345,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(() => Discount.percentage(invalid)).toThrow(RangeError);
    }
  });

  it('validates fixed amounts', () => {
    expect(Discount.fixedAmount(MONEY_MAX_CENTS).fixedAmountCents).toBe(
      MONEY_MAX_CENTS,
    );

    for (const invalid of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => Discount.fixedAmount(invalid)).toThrow(RangeError);
    }
  });

  it('rejects inconsistent persisted combinations', () => {
    expect(() =>
      Discount.fromPersistence({
        type: DiscountType.NO_DISCOUNT,
        percentage: 10,
        fixedAmountCents: null,
      }),
    ).toThrow(RangeError);
    expect(() =>
      Discount.fromPersistence({
        type: DiscountType.PERCENTAGE,
        percentage: null,
        fixedAmountCents: null,
      }),
    ).toThrow(RangeError);
    expect(() =>
      Discount.fromPersistence({
        type: DiscountType.PERCENTAGE,
        percentage: 10,
        fixedAmountCents: 500,
      }),
    ).toThrow(RangeError);
    expect(() =>
      Discount.fromPersistence({
        type: DiscountType.FIXED_AMOUNT,
        percentage: null,
        fixedAmountCents: null,
      }),
    ).toThrow(RangeError);
    expect(() =>
      Discount.fromPersistence({
        type: DiscountType.FIXED_AMOUNT,
        percentage: 10,
        fixedAmountCents: 500,
      }),
    ).toThrow(RangeError);
    expect(() =>
      Discount.fromPersistence({
        type: 'UNKNOWN' as DiscountType,
        percentage: null,
        fixedAmountCents: null,
      }),
    ).toThrow(RangeError);
  });

  it('calculates percentage values with HALF_UP and fixed values as-is', () => {
    expect(Discount.percentage(12.34).calculateValueCents(10_000)).toBe(1_234);
    expect(Discount.percentage(12.34).calculateValueCents(10_001)).toBe(1_234);
    expect(Discount.percentage(50).calculateValueCents(999)).toBe(500);
    expect(Discount.percentage(100).calculateValueCents(999)).toBe(999);
    expect(Discount.fixedAmount(500).calculateValueCents(10_000)).toBe(500);
    expect(Discount.noDiscount().calculateValueCents(10_000)).toBe(0);
    expect(() => Discount.percentage(10).calculateValueCents(-1)).toThrow(
      RangeError,
    );
  });

  it('checks whether a fixed discount fits the subtotal', () => {
    expect(Discount.fixedAmount(500).isApplicableTo(500)).toBe(true);
    expect(Discount.fixedAmount(501).isApplicableTo(500)).toBe(false);
    expect(Discount.percentage(100).isApplicableTo(0)).toBe(true);
  });

  it('compares discounts by value', () => {
    expect(Discount.percentage(10).equals(Discount.percentage(10))).toBe(true);
    expect(Discount.percentage(10).equals(Discount.percentage(11))).toBe(false);
    expect(Discount.noDiscount().equals(Discount.fixedAmount(1))).toBe(false);
  });
});

describe('FinancialItem (D87)', () => {
  it('trims names and generates a UUID identity', () => {
    const first = item({ name: '  Tecido  ' });
    const second = item({ name: 'Argola' });

    expect(first.name).toBe('Tecido');
    expect(first.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(first.id).not.toBe(second.id);
  });

  it('rejects empty names at any save', () => {
    for (const name of ['', '   ', null, undefined]) {
      expect(() =>
        FinancialItem.create({
          name: name as unknown as string,
          quantity: 1,
          unitPriceCents: 1,
        }),
      ).toThrow('Financial item name is required');
    }
  });

  it('accepts optional quantities only above zero and within six decimals', () => {
    expect(item({ quantity: null }).quantity).toBeNull();
    expect(item({ quantity: 0.000001 }).quantity).toBe(0.000001);
    expect(item({ quantity: 999_999.999999 }).quantity).toBe(999_999.999999);

    for (const invalid of [0, -1, 1.0000001, 1_000_000]) {
      expect(() => item({ quantity: invalid })).toThrow(RangeError);
    }
  });

  it('accepts optional unit prices only as positive integer cents in range', () => {
    expect(item({ unitPriceCents: null }).unitPriceCents).toBeNull();
    expect(item({ unitPriceCents: 1 }).unitPriceCents).toBe(1);
    expect(item({ unitPriceCents: MONEY_MAX_CENTS }).unitPriceCents).toBe(
      MONEY_MAX_CENTS,
    );

    for (const invalid of [0, -1, 1.5, MONEY_MAX_CENTS + 1]) {
      expect(() => item({ unitPriceCents: invalid })).toThrow(RangeError);
    }
  });

  it('normalizes the optional unit and reports completeness', () => {
    expect(item({ unit: '  m  ' }).unit).toBe('m');
    expect(item({ unit: '   ' }).unit).toBeNull();
    expect(item({ unit: undefined }).unit).toBeNull();
    expect(item().isComplete).toBe(true);
    expect(item({ quantity: null }).isComplete).toBe(false);
    expect(item({ unitPriceCents: null }).isComplete).toBe(false);
  });

  it('derives the item total per item with HALF_UP', () => {
    expect(item({ quantity: 8.05, unitPriceCents: 3_000 }).totalCents).toBe(
      24_150,
    );
    expect(item({ quantity: 0.333333, unitPriceCents: 100 }).totalCents).toBe(
      33,
    );
    expect(item({ quantity: 0.5, unitPriceCents: 1 }).totalCents).toBe(1);
    expect(item({ quantity: null }).totalCents).toBeNull();
    expect(item({ unitPriceCents: null }).totalCents).toBeNull();
  });

  it('updates partially: omitted keeps, null clears, value replaces', () => {
    const component = item({
      name: 'Tecido',
      quantity: 2,
      unitPriceCents: 100,
    });

    component.update({ unit: 'm' });
    expect(component.name).toBe('Tecido');
    expect(component.quantity).toBe(2);
    expect(component.unitPriceCents).toBe(100);
    expect(component.unit).toBe('m');

    component.update({ name: 'Linho', quantity: null, unitPriceCents: null });

    expect(component.name).toBe('Linho');
    expect(component.quantity).toBeNull();
    expect(component.unitPriceCents).toBeNull();
    expect(component.unit).toBe('m');
  });

  it('reconciles by id: updates, creates, removes and rejects unknown or duplicated ids', () => {
    const first = item({ name: 'Tecido' });
    const second = item({ name: 'Argola' });
    const current = [first, second];

    const reconciled = reconcileFinancialItems(current, [
      { id: first.id, name: 'Linho' },
      { name: 'Suporte', quantity: 2, unitPriceCents: 300 },
    ]);

    expect(reconciled).toHaveLength(2);
    expect(reconciled[0]).toBe(first);
    expect(reconciled[0]?.name).toBe('Linho');
    expect(reconciled[1]?.name).toBe('Suporte');
    // The source array is not mutated; omission only affects the result.
    expect(current).toHaveLength(2);
    expect(current[0]).toBe(first);
    expect(current[1]).toBe(second);
    expect(reconciled).not.toContain(second);

    expect(() =>
      reconcileFinancialItems(current, [{ id: UNKNOWN_ID, name: 'X' }]),
    ).toThrow(UnknownQuoteItemError);
    expect(() =>
      reconcileFinancialItems(current, [
        { id: first.id, name: 'A' },
        { id: first.id, name: 'B' },
      ]),
    ).toThrow(UnknownQuoteItemError);
  });
});

describe('Curtain (D83/D84/D85)', () => {
  it('owns identity and a default sequence of one', () => {
    const first = curtain();
    const second = curtain();

    expect(first.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(first.id).not.toBe(second.id);
    expect(first.sequence).toBe(1);
    expect(() => Curtain.create({ sequence: 0 })).toThrow(RangeError);
    expect(() => Curtain.create({ sequence: 1.5 })).toThrow(RangeError);
  });

  it('applies border and fabric-factor defaults when absent or null', () => {
    expect(curtain().borderValue).toBe(DEFAULT_BORDER_VALUE);
    expect(curtain().fabricFactor).toBe(DEFAULT_FABRIC_FACTOR);
    expect(curtain({ borderValue: null }).borderValue).toBe(
      DEFAULT_BORDER_VALUE,
    );
    expect(curtain({ fabricFactor: null }).fabricFactor).toBe(
      DEFAULT_FABRIC_FACTOR,
    );
    expect(curtain({ borderValue: 0 }).borderValue).toBe(0);
  });

  it('normalizes text fields', () => {
    const entity = curtain({
      room: '  Sala  ',
      description: '  Principal ',
      material: ' Linho ',
      notes: '   ',
    });

    expect(entity.room).toBe('Sala');
    expect(entity.description).toBe('Principal');
    expect(entity.material).toBe('Linho');
    expect(entity.notes).toBeNull();
  });

  it('validates measures and their bounds', () => {
    expect(curtain({ openingWidth: 999_999.999 }).openingWidth).toBe(
      999_999.999,
    );
    expect(curtain({ borderValue: 999.999 }).borderValue).toBe(999.999);
    expect(curtain({ fabricFactor: 999.999 }).fabricFactor).toBe(999.999);

    expect(() => curtain({ openingWidth: 1_000_000 })).toThrow(RangeError);
    expect(() => curtain({ height: 1_000_000 })).toThrow(RangeError);
    expect(() => curtain({ borderValue: 1_000 })).toThrow(RangeError);
    expect(() => curtain({ fabricFactor: 1_000 })).toThrow(RangeError);
    expect(() => curtain({ openingWidth: -1 })).toThrow(RangeError);
    expect(() => curtain({ openingWidth: 1.2345 })).toThrow(RangeError);
  });

  it('derives final width and fabric quantity; null when a needed value is missing', () => {
    const entity = curtain({
      openingWidth: 2,
      borderValue: 0.15,
      fabricFactor: 3.5,
    });

    expect(entity.finalWidth).toBe(2.3);
    expect(entity.fabricQuantity).toBe(8.05);

    expect(curtain({ openingWidth: null }).finalWidth).toBeNull();
    expect(curtain({ openingWidth: null }).fabricQuantity).toBeNull();
    expect(curtain({ fabricFactor: 0 }).fabricQuantity).toBe(0);

    entity.applyPatch({ borderValue: null });
    expect(entity.finalWidth).toBeNull();
    expect(entity.fabricQuantity).toBeNull();
  });

  it('sums complete components and ignores incomplete ones', () => {
    const entity = curtain({
      components: [
        item({ quantity: 1, unitPriceCents: 100 }),
        item({ quantity: 1, unitPriceCents: 200 }),
        item({ quantity: null, unitPriceCents: 300 }),
      ],
    });

    expect(entity.financialTotalCents).toBe(300);
  });

  it('applies partial patches and reconciles components', () => {
    const component = item({
      name: 'Tecido',
      quantity: 1,
      unitPriceCents: 100,
    });
    const entity = curtain({ components: [component], notes: 'Nota' });

    entity.applyPatch({
      room: 'Quarto',
      components: [{ id: component.id, name: 'Linho' }],
    });

    expect(entity.room).toBe('Quarto');
    expect(entity.notes).toBe('Nota');
    expect(entity.components).toHaveLength(1);
    expect(entity.components[0]).toBe(component);
    expect(component.name).toBe('Linho');
  });
});

describe('Quote creation and boundary (D76/D78/D79)', () => {
  it('creates a DRAFT with identity, timestamps and empty lifecycle', () => {
    const quote = draft();

    expect(quote.status).toBe(QuoteStatus.DRAFT);
    expect(quote.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(quote.customerId).toBe(CUSTOMER_ID);
    expect(quote.quoteNumber.value).toBe('ORÇ-2026-001');
    expect(quote.createdAt).toBe(CREATED_AT);
    expect(quote.updatedAt).toBe(CREATED_AT);
    expect(quote.firstSentAt).toBeNull();
    expect(quote.validUntil).toBeNull();
    expect(quote.confirmedAt).toBeNull();
    expect(quote.productionStartedAt).toBeNull();
    expect(quote.scheduledInstallationAt).toBeNull();
    expect(quote.completedAt).toBeNull();
  });

  it('defaults optional composition and normalizes scalars', () => {
    const quote = Quote.create({
      quoteNumber: number(),
      customerId: CUSTOMER_ID,
      createdAt: CREATED_AT,
      notes: '  Cliente preferencial  ',
      commercialAdjustmentCents: 0,
    });

    expect(quote.installationAddress).toBeNull();
    expect(quote.curtains).toEqual([]);
    expect(quote.generalAddOns).toEqual([]);
    expect(quote.discount.type).toBe(DiscountType.NO_DISCOUNT);
    expect(quote.notes).toBe('Cliente preferencial');
    expect(quote.commercialAdjustmentCents).toBeNull();
  });

  it('keeps the status enum wire values in English', () => {
    expect(QuoteStatus.DRAFT).toBe('DRAFT');
    expect(QuoteStatus.SENT).toBe('SENT');
    expect(QuoteStatus.CONFIRMED).toBe('CONFIRMED');
    expect(QuoteStatus.IN_PRODUCTION).toBe('IN_PRODUCTION');
    expect(QuoteStatus.COMPLETED).toBe('COMPLETED');
    expect(QuoteStatus.CANCELLED).toBe('CANCELLED');
  });

  it('validates the creation instant and the adjustment', () => {
    expect(() =>
      Quote.create({
        quoteNumber: number(),
        customerId: CUSTOMER_ID,
        createdAt: new Date('invalid'),
      }),
    ).toThrow(RangeError);
    expect(() => draft({ commercialAdjustmentCents: 1.5 })).toThrow(RangeError);
    expect(() =>
      draft({ commercialAdjustmentCents: MONEY_MAX_CENTS + 1 }),
    ).toThrow(RangeError);
  });

  it('keeps customerId immutable: the aggregate has no operation to change it', () => {
    const quote = draft();

    quote.applyPatch({ notes: 'Novo' });

    expect(quote.customerId).toBe(CUSTOMER_ID);
  });

  it('normalizes curtain sequences to 1..N by array order', () => {
    const quote = draft({
      curtains: [
        curtain({ sequence: 9, room: 'Primeira' }),
        curtain({ sequence: 4, room: 'Segunda' }),
      ],
    });

    expect(quote.curtains.map((entry) => entry.sequence)).toEqual([1, 2]);
    expect(quote.curtains.map((entry) => entry.room)).toEqual([
      'Primeira',
      'Segunda',
    ]);
  });

  it('never creates labor or any other item automatically (D89)', () => {
    const quote = draft({ curtains: [curtain({ components: [] })] });

    expect(quote.generalAddOns).toEqual([]);
    expect(quote.curtains[0]?.components).toEqual([]);
  });

  it('keeps no event history inside the aggregate (D108)', () => {
    const quote = draft();

    expect('history' in quote).toBe(false);
    expect('events' in quote).toBe(false);
  });
});

describe('derived totals (D88/D91/D92/D93)', () => {
  function totalsFixture(): Quote {
    return Quote.create({
      quoteNumber: number(),
      customerId: CUSTOMER_ID,
      createdAt: CREATED_AT,
      curtains: [
        curtain({
          components: [
            item({ quantity: 8.05, unitPriceCents: 3_000 }),
            item({ quantity: 0.333333, unitPriceCents: 100 }),
          ],
        }),
        curtain({
          components: [item({ quantity: 1, unitPriceCents: 500 })],
        }),
      ],
      generalAddOns: [
        item({ name: 'Frete', quantity: 2, unitPriceCents: 1_000 }),
      ],
      discount: Discount.percentage(10),
      commercialAdjustmentCents: -500,
    });
  }

  it('rounds each item before summing (D93)', () => {
    const quote = totalsFixture();

    // 24_150 + 33 (33.3333 rounded) + 500
    expect(quote.curtainsSubtotalCents).toBe(24_683);
    expect(quote.generalAddOnsSubtotalCents).toBe(2_000);
    expect(quote.subtotalCents).toBe(26_683);
    expect(quote.discountValueCents).toBe(2_668);
    expect(quote.calculatedTotalCents).toBe(24_015);
    expect(quote.effectiveCommercialAdjustmentCents).toBe(-500);
    expect(quote.totalCents).toBe(23_515);
  });

  it('rounds ties per item, not after the sum', () => {
    const quote = Quote.create({
      quoteNumber: number(),
      customerId: CUSTOMER_ID,
      createdAt: CREATED_AT,
      curtains: [
        curtain({
          components: [
            item({ quantity: 0.5, unitPriceCents: 1 }),
            item({ quantity: 0.5, unitPriceCents: 1 }),
          ],
        }),
      ],
    });

    expect(quote.curtainsSubtotalCents).toBe(2);
  });

  it('applies a fixed discount to the subtotal', () => {
    const quote = Quote.create({
      quoteNumber: number(),
      customerId: CUSTOMER_ID,
      createdAt: CREATED_AT,
      curtains: [
        curtain({ components: [item({ quantity: 1, unitPriceCents: 1_000 })] }),
      ],
      discount: Discount.fixedAmount(300),
    });

    expect(quote.subtotalCents).toBe(1_000);
    expect(quote.discountValueCents).toBe(300);
    expect(quote.calculatedTotalCents).toBe(700);
    expect(quote.totalCents).toBe(700);
  });

  it('exposes zero for an absent adjustment', () => {
    expect(draft().commercialAdjustmentCents).toBeNull();
    expect(draft().effectiveCommercialAdjustmentCents).toBe(0);
  });

  it('applies the adjustment after the discount', () => {
    const base = {
      quoteNumber: number(),
      customerId: CUSTOMER_ID,
      createdAt: CREATED_AT,
      curtains: [
        curtain({ components: [item({ quantity: 1, unitPriceCents: 1_000 })] }),
      ],
    };

    expect(Quote.create(base).totalCents).toBe(1_000);
    expect(
      Quote.create({ ...base, commercialAdjustmentCents: 200 }).totalCents,
    ).toBe(1_200);
    expect(
      Quote.create({ ...base, commercialAdjustmentCents: -200 }).totalCents,
    ).toBe(800);
    expect(
      Quote.create({
        ...base,
        discount: Discount.percentage(10),
        commercialAdjustmentCents: 200,
      }).totalCents,
    ).toBe(1_100);
  });

  it('treats incomplete items as zero in draft totals', () => {
    const quote = Quote.create({
      quoteNumber: number(),
      customerId: CUSTOMER_ID,
      createdAt: CREATED_AT,
      curtains: [
        curtain({
          components: [
            item({ quantity: 1, unitPriceCents: 100 }),
            item({ quantity: null, unitPriceCents: 5_000 }),
          ],
        }),
      ],
      generalAddOns: [item({ quantity: null, unitPriceCents: 5_000 })],
    });

    expect(quote.curtainsSubtotalCents).toBe(100);
    expect(quote.generalAddOnsSubtotalCents).toBe(0);
    expect(quote.subtotalCents).toBe(100);
    expect(quote.totalCents).toBe(100);
  });
});

describe('partial update semantics (D117)', () => {
  it('is allowed only in DRAFT or SENT, including an expired SENT quote', () => {
    const expired = sent({ validUntil: new Date(NOW.getTime() - 1) });

    expect(() => draft().applyPatch({ notes: 'X' })).not.toThrow();
    expect(() => expired.applyPatch({ notes: 'X' })).not.toThrow();

    for (const quote of [
      confirmed(),
      inProduction(),
      rehydrated({ status: QuoteStatus.COMPLETED }),
      rehydrated({ status: QuoteStatus.CANCELLED }),
    ]) {
      expect(() => quote.applyPatch({ notes: 'X' })).toThrow(
        QuoteNotEditableError,
      );
    }
  });

  it('keeps omitted scalars, clears with null and replaces values', () => {
    const quote = draft({
      notes: 'Atual',
      discount: Discount.percentage(10),
      commercialAdjustmentCents: -100,
      installationAddress: completeAddress(),
    });

    quote.applyPatch({});

    expect(quote.notes).toBe('Atual');
    expect(quote.discount.type).toBe(DiscountType.PERCENTAGE);
    expect(quote.commercialAdjustmentCents).toBe(-100);
    expect(quote.installationAddress?.street).toBe('Avenida Paulista');

    quote.applyPatch({
      notes: null,
      discount: null,
      commercialAdjustmentCents: null,
      installationAddress: null,
    });

    expect(quote.notes).toBeNull();
    expect(quote.discount.type).toBe(DiscountType.NO_DISCOUNT);
    expect(quote.commercialAdjustmentCents).toBeNull();
    expect(quote.installationAddress).toBeNull();

    quote.applyPatch({
      notes: 'Novo',
      discount: Discount.fixedAmount(200),
      commercialAdjustmentCents: 300,
      installationAddress: completeAddress(),
    });

    expect(quote.notes).toBe('Novo');
    expect(quote.discount.fixedAmountCents).toBe(200);
    expect(quote.commercialAdjustmentCents).toBe(300);
    expect(quote.installationAddress).not.toBeNull();
  });

  it('does not require resending curtains when patching scalars', () => {
    const quote = draft();
    const keep = quote.curtains[0];

    quote.applyPatch({ notes: 'Somente notas' });

    expect(quote.curtains).toHaveLength(1);
    expect(quote.curtains[0]).toBe(keep);
  });

  it('replaces only the sent collections at each level', () => {
    const component = item({ name: 'Tecido' });
    const existing = curtain({ room: 'Sala', components: [component] });
    const addOn = item({ name: 'Frete' });
    const quote = draft({ curtains: [existing], generalAddOns: [addOn] });

    quote.applyPatch({ curtains: [{ id: existing.id, room: 'Quarto' }] });

    expect(quote.curtains).toHaveLength(1);
    expect(quote.curtains[0]).toBe(existing);
    expect(existing.room).toBe('Quarto');
    expect(existing.components[0]).toBe(component);
    expect(quote.generalAddOns[0]).toBe(addOn);

    quote.applyPatch({
      curtains: [
        { id: existing.id, components: [{ id: component.id, name: 'Linho' }] },
      ],
      generalAddOns: [{ name: 'Instalação', quantity: 1, unitPriceCents: 500 }],
    });

    expect(existing.components).toHaveLength(1);
    expect(existing.components[0]).toBe(component);
    expect(component.name).toBe('Linho');
    expect(quote.generalAddOns).toHaveLength(1);
    expect(quote.generalAddOns[0]).not.toBe(addOn);
    expect(quote.generalAddOns[0]?.name).toBe('Instalação');
  });

  it('creates new curtains and recalculates sequences from the sent order', () => {
    const quote = draft();
    const originalId = quote.curtains[0]?.id;

    quote.applyPatch({
      curtains: [{ room: 'Quarto' }, { room: 'Sala' }],
    });

    expect(quote.curtains).toHaveLength(2);
    expect(quote.curtains.map((entry) => entry.sequence)).toEqual([1, 2]);
    expect(quote.curtains.map((entry) => entry.room)).toEqual([
      'Quarto',
      'Sala',
    ]);
    expect(quote.curtains[0]?.id).not.toBe(originalId);
  });

  it('replaces omitted curtains when the collection contains no ids', () => {
    const quote = draft({
      curtains: [curtain({ room: 'Sala' }), curtain({ room: 'Quarto' })],
    });

    quote.applyPatch({ curtains: [{ room: 'Sala' }] });

    expect(quote.curtains).toHaveLength(1);
    expect(quote.curtains[0]?.room).toBe('Sala');
    // A new curtain starts without components; the old ones were removed.
    expect(quote.curtains[0]?.components).toHaveLength(0);
  });

  it('rejects unknown, duplicated and foreign ids before mutating anything', () => {
    const quote = draft({ notes: 'Original' });

    expect(() =>
      quote.applyPatch({ notes: 'Alterado', curtains: [{ id: UNKNOWN_ID }] }),
    ).toThrow(UnknownQuoteItemError);
    expect(quote.notes).toBe('Original');

    const curtainId = quote.curtains[0]?.id;

    expect(() =>
      quote.applyPatch({
        curtains: [{ id: curtainId }, { id: curtainId }],
      }),
    ).toThrow(UnknownQuoteItemError);

    const componentId = quote.curtains[0]?.components[0]?.id;

    expect(() =>
      quote.applyPatch({
        curtains: [
          {
            id: curtainId,
            components: [{ id: UNKNOWN_ID }, { id: componentId }],
          },
        ],
      }),
    ).toThrow(UnknownQuoteItemError);

    expect(() =>
      quote.applyPatch({
        curtains: [
          {
            id: curtainId,
            components: [{ id: componentId }, { id: componentId }],
          },
        ],
      }),
    ).toThrow(UnknownQuoteItemError);

    expect(quote.notes).toBe('Original');
  });

  it('keeps status, firstSentAt and validUntil when editing a SENT quote', () => {
    const quote = sent();
    const firstSentAt = quote.firstSentAt;
    const validUntil = quote.validUntil;

    quote.applyPatch({ notes: 'Ajuste' });

    expect(quote.status).toBe(QuoteStatus.SENT);
    expect(quote.firstSentAt).toBe(firstSentAt);
    expect(quote.validUntil).toBe(validUntil);
  });

  it('recalculates sequences after reordering a sent collection', () => {
    const first = curtain({ room: 'Sala' });
    const second = curtain({ room: 'Quarto' });
    const quote = draft({ curtains: [first, second] });

    quote.applyPatch({
      curtains: [{ id: second.id }, { id: first.id }],
    });

    expect(quote.curtains.map((entry) => entry.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(quote.curtains.map((entry) => entry.sequence)).toEqual([1, 2]);
  });
});

describe('state machine (D96)', () => {
  it('moves DRAFT through the commercial flow to COMPLETED', () => {
    const quote = draft();

    quote.markAsSent(NOW);
    expect(quote.status).toBe(QuoteStatus.SENT);

    quote.confirm(NOW);
    expect(quote.status).toBe(QuoteStatus.CONFIRMED);

    quote.startProduction(NOW);
    expect(quote.status).toBe(QuoteStatus.IN_PRODUCTION);

    quote.setScheduledInstallation(new Date(NOW.getTime() - 1));
    quote.complete(NOW);
    expect(quote.status).toBe(QuoteStatus.COMPLETED);
  });

  it('allows the reopen path and cancellation from the permitted statuses', () => {
    const reopened = confirmed();
    reopened.reopen();
    expect(reopened.status).toBe(QuoteStatus.SENT);

    for (const quote of [
      draft(),
      sent(),
      sent({ validUntil: new Date(NOW.getTime() - 1) }),
      confirmed(),
    ]) {
      quote.cancel('Cliente desistiu');
      expect(quote.status).toBe(QuoteStatus.CANCELLED);
    }
  });

  it('rejects every transition from an invalid status', () => {
    const cases: Array<() => unknown> = [
      () => draft().confirm(NOW),
      () => draft().reopen(),
      () => draft().renew(LATER, NOW),
      () => draft().startProduction(NOW),
      () => draft().setScheduledInstallation(NOW),
      () => draft().removeScheduledInstallation(),
      () => draft().complete(NOW),
      () => sent().markAsSent(NOW),
      () => sent().startProduction(NOW),
      () => sent().setScheduledInstallation(NOW),
      () => sent().removeScheduledInstallation(),
      () => sent().complete(NOW),
      () => confirmed().markAsSent(NOW),
      () => confirmed().confirm(NOW),
      () => confirmed().renew(LATER, NOW),
      () => confirmed().complete(NOW),
      () => inProduction().markAsSent(NOW),
      () => inProduction().confirm(NOW),
      () => inProduction().reopen(),
      () => inProduction().renew(LATER, NOW),
      () => inProduction().cancel(),
      () => inProduction().startProduction(NOW),
      () => rehydrated({ status: QuoteStatus.COMPLETED }).cancel(),
      () => rehydrated({ status: QuoteStatus.CANCELLED }).cancel(),
    ];

    for (const operation of cases) {
      expectRejected(operation);
    }
  });

  it('keeps COMPLETED and CANCELLED terminal', () => {
    const completed = rehydrated({ status: QuoteStatus.COMPLETED });
    const cancelled = rehydrated({ status: QuoteStatus.CANCELLED });

    for (const quote of [completed, cancelled]) {
      expect(() => quote.markAsSent(NOW)).toThrow(InvalidQuoteTransitionError);
      expect(() => quote.confirm(NOW)).toThrow(InvalidQuoteTransitionError);
      expect(() => quote.renew(LATER, NOW)).toThrow(
        InvalidQuoteTransitionError,
      );
      expect(() => quote.reopen()).toThrow(InvalidQuoteTransitionError);
      expect(() => quote.startProduction(NOW)).toThrow(
        InvalidQuoteTransitionError,
      );
      expect(() => quote.cancel()).toThrow(InvalidQuoteTransitionError);
      expect(() => quote.complete(NOW)).toThrow(InvalidQuoteTransitionError);
      expect(() => quote.applyPatch({ notes: 'X' })).toThrow(
        QuoteNotEditableError,
      );
    }
  });
});

describe('send gate (D97)', () => {
  it('sends a complete draft', () => {
    const quote = draft();

    expect(quote.validateForSend()).toEqual([]);
    quote.markAsSent(NOW);

    expect(quote.status).toBe(QuoteStatus.SENT);
    expect(quote.firstSentAt).toBe(NOW);
    expect(quote.validUntil?.getTime()).toBe(THIRTY_DAYS_AFTER_NOW.getTime());
  });

  it('accumulates violations instead of failing fast', () => {
    const quote = Quote.create({
      quoteNumber: number(),
      customerId: CUSTOMER_ID,
      createdAt: CREATED_AT,
      installationAddress: null,
      curtains: [],
    });

    expect(violationCodes(quote)).toEqual(
      expect.arrayContaining([
        'INSTALLATION_ADDRESS_INCOMPLETE',
        'NO_CURTAINS',
        'TOTAL_NOT_POSITIVE',
      ]),
    );
  });

  it('requires a complete installation address', () => {
    expect(violationCodes(draft({ installationAddress: null }))).toContain(
      'INSTALLATION_ADDRESS_INCOMPLETE',
    );
    expect(
      violationCodes(
        draft({
          installationAddress: InstallationAddress.create({ street: 'Rua A' }),
        }),
      ),
    ).toContain('INSTALLATION_ADDRESS_INCOMPLETE');
  });

  it('requires at least one curtain', () => {
    expect(violationCodes(draft({ curtains: [] }))).toContain('NO_CURTAINS');
  });

  it('requires each curtain technical field', () => {
    expect(
      violationCodes(draft({ curtains: [curtain({ room: null })] })),
    ).toContain('CURTAIN_ROOM_REQUIRED');
    expect(
      violationCodes(draft({ curtains: [curtain({ openingWidth: null })] })),
    ).toContain('CURTAIN_OPENING_WIDTH_INVALID');
    expect(
      violationCodes(draft({ curtains: [curtain({ openingWidth: 0 })] })),
    ).toContain('CURTAIN_OPENING_WIDTH_INVALID');
    expect(
      violationCodes(draft({ curtains: [curtain({ height: null })] })),
    ).toContain('CURTAIN_HEIGHT_INVALID');
    expect(
      violationCodes(draft({ curtains: [curtain({ height: 0 })] })),
    ).toContain('CURTAIN_HEIGHT_INVALID');
    expect(
      violationCodes(draft({ curtains: [curtain({ fabricFactor: 0 })] })),
    ).toContain('CURTAIN_FABRIC_FACTOR_INVALID');
    expect(
      violationCodes(draft({ curtains: [curtain({ material: null })] })),
    ).toContain('CURTAIN_MATERIAL_REQUIRED');
  });

  it('requires an informed border, including when cleared by a patch', () => {
    const quote = draft();

    quote.curtains[0]?.applyPatch({ borderValue: null });

    expect(violationCodes(quote)).toContain('CURTAIN_BORDER_INVALID');
  });

  it('requires at least one complete component and rejects incomplete ones', () => {
    expect(
      violationCodes(draft({ curtains: [curtain({ components: [] })] })),
    ).toContain('CURTAIN_COMPONENT_REQUIRED');
    expect(
      violationCodes(
        draft({
          curtains: [
            curtain({
              components: [item({ quantity: null, unitPriceCents: 1_000 })],
            }),
          ],
        }),
      ),
    ).toContain('COMPONENT_INVALID');
  });

  it('rejects incomplete general add-ons', () => {
    expect(
      violationCodes(
        draft({ generalAddOns: [item({ quantity: 1, unitPriceCents: null })] }),
      ),
    ).toContain('GENERAL_ADD_ON_INVALID');
  });

  it('rejects a fixed discount above the subtotal', () => {
    expect(
      violationCodes(draft({ discount: Discount.fixedAmount(999_999) })),
    ).toContain('DISCOUNT_EXCEEDS_SUBTOTAL');
  });

  it('rejects a total that is not positive', () => {
    expect(
      violationCodes(draft({ discount: Discount.percentage(100) })),
    ).toContain('TOTAL_NOT_POSITIVE');
  });

  it('does not mutate the quote when the gate fails', () => {
    const quote = draft({ installationAddress: null });

    expect(() => quote.markAsSent(NOW)).toThrow(QuoteValidationError);
    expect(quote.status).toBe(QuoteStatus.DRAFT);
    expect(quote.firstSentAt).toBeNull();
    expect(quote.validUntil).toBeNull();
  });
});

describe('send validity (D98)', () => {
  it('applies the default 30-day validity when omitted', () => {
    const quote = draft();

    quote.markAsSent(NOW);

    expect(quote.validUntil?.toISOString()).toBe('2026-11-19T12:00:00.000Z');
  });

  it('applies an explicit future validity', () => {
    const quote = draft();
    const validUntil = new Date(NOW.getTime() + 1);

    quote.markAsSent(NOW, validUntil);

    expect(quote.validUntil).toBe(validUntil);
  });

  it('rejects an explicit validity that is not strictly future', () => {
    for (const validUntil of [NOW, new Date(NOW.getTime() - 1)]) {
      const quote = draft();

      expect(() => quote.markAsSent(NOW, validUntil)).toThrow(
        QuoteValidationError,
      );
      expect(quote.status).toBe(QuoteStatus.DRAFT);
    }
  });

  it('rejects invalid dates', () => {
    const quote = draft();

    expect(() => quote.markAsSent(new Date('invalid'))).toThrow(RangeError);
    expect(() => draft().markAsSent(NOW, new Date('invalid'))).toThrow(
      RangeError,
    );
  });

  it('cannot send twice', () => {
    const quote = draft();

    quote.markAsSent(NOW);

    expect(() => quote.markAsSent(LATER)).toThrow(InvalidQuoteTransitionError);
    expect(quote.firstSentAt).toBe(NOW);
  });
});

describe('confirmation, reopening and renewal (D99/D100/D101)', () => {
  it('confirms a SENT quote within its validity', () => {
    const quote = sent();

    quote.confirm(NOW);

    expect(quote.status).toBe(QuoteStatus.CONFIRMED);
    expect(quote.confirmedAt).toBe(NOW);
  });

  it('confirms exactly at the validity boundary', () => {
    const quote = sent({ validUntil: NOW });

    quote.confirm(NOW);

    expect(quote.status).toBe(QuoteStatus.CONFIRMED);
  });

  it('blocks confirmation after expiry or without a validity', () => {
    expect(() =>
      sent({ validUntil: new Date(NOW.getTime() - 1) }).confirm(NOW),
    ).toThrow(InvalidQuoteTransitionError);
    expect(() => sent({ validUntil: null }).confirm(NOW)).toThrow(
      InvalidQuoteTransitionError,
    );
  });

  it('reopens CONFIRMED to SENT, clearing confirmation and schedule', () => {
    const schedule = new Date(NOW.getTime() + 3_600_000);
    const quote = confirmed({ scheduledInstallationAt: schedule });
    const firstSentAt = quote.firstSentAt;
    const validUntil = quote.validUntil;

    const previous = quote.reopen();

    expect(quote.status).toBe(QuoteStatus.SENT);
    expect(quote.confirmedAt).toBeNull();
    expect(quote.scheduledInstallationAt).toBeNull();
    expect(quote.firstSentAt).toBe(firstSentAt);
    expect(quote.validUntil).toBe(validUntil);
    expect(previous.previousConfirmedAt).toBe(NOW);
    expect(previous.previousScheduledInstallationAt).toBe(schedule);
  });

  it('returns null previous values when reopening a quote without them', () => {
    const quote = confirmed({ confirmedAt: null });

    expect(quote.reopen()).toEqual({
      previousConfirmedAt: null,
      previousScheduledInstallationAt: null,
    });
  });

  it('renews a valid or expired SENT quote and returns the previous validity', () => {
    for (const current of [LATER, new Date(NOW.getTime() - 1)]) {
      const quote = sent({ validUntil: current });
      const firstSentAt = quote.firstSentAt;
      const next = new Date(NOW.getTime() + 60 * 24 * 60 * 60 * 1000);

      const previous = quote.renew(next, NOW);

      expect(previous).toBe(current);
      expect(quote.validUntil).toBe(next);
      expect(quote.status).toBe(QuoteStatus.SENT);
      expect(quote.firstSentAt).toBe(firstSentAt);
    }
  });

  it('allows renewing to an earlier instant while still in the future', () => {
    const quote = sent({ validUntil: LATER });
    const earlier = new Date(NOW.getTime() + 1);

    quote.renew(earlier, NOW);

    expect(quote.validUntil).toBe(earlier);
  });

  it('rejects a non-future renewal validity', () => {
    for (const next of [NOW, new Date(NOW.getTime() - 1)]) {
      expect(() => sent().renew(next, NOW)).toThrow(QuoteValidationError);
    }
  });

  it('rejects renewal without validity or outside SENT', () => {
    expect(() => sent({ validUntil: null }).renew(LATER, NOW)).toThrow(
      InvalidQuoteTransitionError,
    );
    expect(() => draft().renew(LATER, NOW)).toThrow(
      InvalidQuoteTransitionError,
    );
    expect(() => confirmed().renew(LATER, NOW)).toThrow(
      InvalidQuoteTransitionError,
    );
  });
});

describe('cancellation (D102)', () => {
  it('normalizes and returns the reason', () => {
    const quote = draft();

    expect(quote.cancel('  Cliente desistiu  ')).toBe('Cliente desistiu');
    expect(quote.status).toBe(QuoteStatus.CANCELLED);
    expect(draft().cancel('   ')).toBeNull();
    expect(draft().cancel()).toBeNull();
  });

  it('accepts up to 500 characters and rejects more', () => {
    expect(draft().cancel('a'.repeat(500))).toHaveLength(500);
    expect(() => draft().cancel('a'.repeat(501))).toThrow(RangeError);
  });

  it('cancels expired SENT quotes and preserves the schedule', () => {
    const schedule = new Date(NOW.getTime() + 3_600_000);
    const quote = confirmed({ scheduledInstallationAt: schedule });

    quote.cancel('Cliente desistiu');

    expect(quote.status).toBe(QuoteStatus.CANCELLED);
    expect(quote.scheduledInstallationAt).toBe(schedule);
  });

  it('makes the quote terminal', () => {
    const quote = draft();
    quote.cancel();

    expect(() => quote.cancel()).toThrow(InvalidQuoteTransitionError);
    expect(() => quote.markAsSent(NOW)).toThrow(InvalidQuoteTransitionError);
    expect(() => quote.applyPatch({ notes: 'X' })).toThrow(
      QuoteNotEditableError,
    );
  });
});

describe('production and installation (D103/D104)', () => {
  it('starts production only from CONFIRMED and records the instant', () => {
    const quote = confirmed();

    quote.startProduction(NOW);

    expect(quote.status).toBe(QuoteStatus.IN_PRODUCTION);
    expect(quote.productionStartedAt).toBe(NOW);
  });

  it('schedules, changes and removes an installation', () => {
    const quote = confirmed();
    const first = new Date(NOW.getTime() + 3_600_000);
    const second = new Date(NOW.getTime() + 7_200_000);

    expect(quote.setScheduledInstallation(first)).toBe('SCHEDULED');
    expect(quote.scheduledInstallationAt).toBe(first);
    expect(quote.setScheduledInstallation(second)).toBe('CHANGED');
    expect(quote.scheduledInstallationAt).toBe(second);
    expect(quote.setScheduledInstallation(second)).toBe('UNCHANGED');
    expect(quote.removeScheduledInstallation()).toBe(second);
    expect(quote.scheduledInstallationAt).toBeNull();
    expect(quote.removeScheduledInstallation()).toBeNull();
  });

  it('accepts past installation instants', () => {
    const quote = inProduction();
    const past = new Date(NOW.getTime() - 3_600_000);

    expect(quote.setScheduledInstallation(past)).toBe('SCHEDULED');
    expect(quote.scheduledInstallationAt).toBe(past);
  });

  it('rejects invalid instants and scheduling outside the allowed statuses', () => {
    expect(() =>
      confirmed().setScheduledInstallation(new Date('invalid')),
    ).toThrow(RangeError);
    expect(() => sent().setScheduledInstallation(NOW)).toThrow(
      InvalidQuoteTransitionError,
    );
    expect(() => draft().removeScheduledInstallation()).toThrow(
      InvalidQuoteTransitionError,
    );
  });
});

describe('service completion (D105)', () => {
  it('completes IN_PRODUCTION with no installation or a past one', () => {
    const withoutInstallation = inProduction();

    withoutInstallation.complete(NOW);
    expect(withoutInstallation.status).toBe(QuoteStatus.COMPLETED);
    expect(withoutInstallation.completedAt).toBe(NOW);

    const withPastInstallation = inProduction({
      scheduledInstallationAt: new Date(NOW.getTime() - 1),
    });

    withPastInstallation.complete(NOW);
    expect(withPastInstallation.status).toBe(QuoteStatus.COMPLETED);
  });

  it('completes exactly at the scheduled instant', () => {
    const quote = inProduction({ scheduledInstallationAt: NOW });

    quote.complete(NOW);

    expect(quote.status).toBe(QuoteStatus.COMPLETED);
  });

  it('blocks completion while the installation is in the future', () => {
    const quote = inProduction({
      scheduledInstallationAt: new Date(NOW.getTime() + 1),
    });

    expect(() => quote.complete(NOW)).toThrow(InvalidQuoteTransitionError);
    expect(quote.status).toBe(QuoteStatus.IN_PRODUCTION);
  });
});

describe('derived expiration and late installation (D106/D107)', () => {
  it('derives expiration only for SENT quotes with an elapsed validity', () => {
    expect(
      sent({ validUntil: new Date(NOW.getTime() - 1) }).isExpired(NOW),
    ).toBe(true);
    expect(sent({ validUntil: NOW }).isExpired(NOW)).toBe(false);
    expect(sent({ validUntil: LATER }).isExpired(NOW)).toBe(false);
    expect(sent({ validUntil: null }).isExpired(NOW)).toBe(false);
    expect(
      confirmed({ validUntil: new Date(NOW.getTime() - 1) }).isExpired(NOW),
    ).toBe(false);
    expect(draft().isExpired(new Date(CREATED_AT.getTime() + 1))).toBe(false);
  });

  it('rejects an invalid expiration reference instant', () => {
    expect(() => sent().isExpired(new Date('invalid'))).toThrow(RangeError);
  });

  it('derives late installation only for operational statuses', () => {
    const past = new Date(NOW.getTime() - 1);

    expect(
      confirmed({ scheduledInstallationAt: past }).isLateInstallation(NOW),
    ).toBe(true);
    expect(
      inProduction({ scheduledInstallationAt: past }).isLateInstallation(NOW),
    ).toBe(true);
    expect(
      confirmed({ scheduledInstallationAt: NOW }).isLateInstallation(NOW),
    ).toBe(false);
    expect(
      confirmed({ scheduledInstallationAt: LATER }).isLateInstallation(NOW),
    ).toBe(false);
    expect(
      sent({ scheduledInstallationAt: past }).isLateInstallation(NOW),
    ).toBe(false);
    expect(
      rehydrated({
        status: QuoteStatus.COMPLETED,
        scheduledInstallationAt: past,
      }).isLateInstallation(NOW),
    ).toBe(false);
    expect(confirmed().isLateInstallation(NOW)).toBe(false);
  });
});

describe('draft deletion guard (D110)', () => {
  it('allows physical deletion only for DRAFT', () => {
    expect(() => draft().assertDraftForDeletion()).not.toThrow();

    for (const quote of [
      sent(),
      confirmed(),
      inProduction(),
      rehydrated({ status: QuoteStatus.COMPLETED }),
      rehydrated({ status: QuoteStatus.CANCELLED }),
    ]) {
      expect(() => quote.assertDraftForDeletion()).toThrow(
        InvalidQuoteTransitionError,
      );
    }
  });
});

describe('history details (D109)', () => {
  it('builds the creation and first-send payloads', () => {
    expect(QuoteHistoryDetails.created('ORÇ-2026-001')).toEqual({
      quoteNumber: 'ORÇ-2026-001',
    });
    expect(QuoteHistoryDetails.sent(LATER)).toEqual({
      validUntil: '2026-11-18T12:00:00.000Z',
      firstSend: true,
    });
    expect(() => QuoteHistoryDetails.sent(new Date('invalid'))).toThrow(
      RangeError,
    );
  });

  it('builds reopened and renewed payloads', () => {
    expect(QuoteHistoryDetails.reopened(null, null)).toEqual({
      previousConfirmedAt: null,
      previousScheduledInstallationAt: null,
    });
    expect(QuoteHistoryDetails.reopened(NOW, LATER)).toEqual({
      previousConfirmedAt: '2026-10-20T12:00:00.000Z',
      previousScheduledInstallationAt: '2026-11-18T12:00:00.000Z',
    });
    expect(QuoteHistoryDetails.renewed(NOW, LATER)).toEqual({
      previousValidUntil: '2026-10-20T12:00:00.000Z',
      newValidUntil: '2026-11-18T12:00:00.000Z',
    });
  });

  it('builds cancellation reason payloads', () => {
    expect(QuoteHistoryDetails.cancelled(null)).toEqual({});
    expect(QuoteHistoryDetails.cancelled('Cliente desistiu')).toEqual({
      reason: 'Cliente desistiu',
    });
  });

  it('builds installation payloads', () => {
    expect(QuoteHistoryDetails.installationScheduled(NOW)).toEqual({
      scheduledInstallationAt: '2026-10-20T12:00:00.000Z',
    });
    expect(QuoteHistoryDetails.installationChanged(NOW, LATER)).toEqual({
      previousScheduledInstallationAt: '2026-10-20T12:00:00.000Z',
      scheduledInstallationAt: '2026-11-18T12:00:00.000Z',
    });
    expect(QuoteHistoryDetails.installationRemoved(NOW)).toEqual({
      previousScheduledInstallationAt: '2026-10-20T12:00:00.000Z',
    });
  });

  it('carries edited change lists without transformation', () => {
    const changes = [{ field: 'notes', previous: null, next: 'Novo' }];

    expect(QuoteHistoryDetails.edited(changes)).toEqual({ changes });
  });
});
