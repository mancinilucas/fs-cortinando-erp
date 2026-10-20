import { describe, expect, it } from 'vitest';
import {
  QuoteMapper,
  type CurtainRecord,
  type FinancialItemRecord,
  type QuoteRecord,
} from './quote.mapper.js';
import { QuoteStatus } from '../../domain/entities/quote.js';
import { Discount, DiscountType } from '../../domain/value-objects/discount.js';
import { InstallationAddress } from '../../domain/value-objects/installation-address.js';
import type { Quote } from '../../domain/entities/quote.js';

const createdAt = new Date('2026-10-19T12:00:00.000Z');
const updatedAt = new Date('2026-10-20T12:00:00.000Z');
const firstSentAt = new Date('2026-10-20T12:00:00.000Z');
const validUntil = new Date('2026-11-19T12:00:00.000Z');
const confirmedAt = new Date('2026-10-25T12:00:00.000Z');
const productionStartedAt = new Date('2026-10-26T12:00:00.000Z');
const scheduledInstallationAt = new Date('2026-11-10T12:00:00.000Z');
const completedAt = new Date('2026-11-11T12:00:00.000Z');

function itemRecord(
  overrides: Partial<FinancialItemRecord> = {},
): FinancialItemRecord {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Tecido',
    quantity: '8.050000',
    unit: 'm',
    unitPriceCents: 3_000,
    ...overrides,
  };
}

function curtainRecord(overrides: Partial<CurtainRecord> = {}): CurtainRecord {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    sequence: 1,
    room: 'Sala',
    description: null,
    material: 'Linho',
    openingWidth: '2.650',
    borderValue: '0.150',
    height: '2.700',
    fabricFactor: '3.500',
    notes: null,
    components: [itemRecord()],
    ...overrides,
  };
}

function quoteRecord(overrides: Partial<QuoteRecord> = {}): QuoteRecord {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    quoteNumber: 'ORÇ-2026-001',
    customerId: '44444444-4444-4444-8444-444444444444',
    status: QuoteStatus.DRAFT,
    notes: null,
    discountType: DiscountType.NO_DISCOUNT,
    discountPercentage: null,
    discountFixedAmountCents: null,
    commercialAdjustmentCents: null,
    installationAddressPostalCode: null,
    installationAddressStreet: null,
    installationAddressNumber: null,
    installationAddressComplement: null,
    installationAddressNeighborhood: null,
    installationAddressCity: null,
    installationAddressState: null,
    createdAt,
    updatedAt,
    firstSentAt: null,
    validUntil: null,
    confirmedAt: null,
    productionStartedAt: null,
    scheduledInstallationAt: null,
    completedAt: null,
    curtains: [],
    generalAddOns: [],
    ...overrides,
  };
}

function rebuildRecord(quote: Quote): QuoteRecord {
  return {
    ...QuoteMapper.toPersistence(quote),
    id: quote.id,
    curtains: quote.curtains.map((curtain) => ({
      ...QuoteMapper.curtainToPersistence(curtain),
      components: curtain.components.map((component) =>
        QuoteMapper.financialItemToPersistence(component),
      ),
    })),
    generalAddOns: quote.generalAddOns.map((addOn) =>
      QuoteMapper.financialItemToPersistence(addOn),
    ),
  };
}

describe('QuoteMapper', () => {
  it('maps a minimal draft and preserves its identity', () => {
    const record = quoteRecord();
    const quote = QuoteMapper.toDomain(record);

    expect(quote.id).toBe(record.id);
    expect(quote.quoteNumber.value).toBe('ORÇ-2026-001');
    expect(quote.customerId).toBe(record.customerId);
    expect(quote.status).toBe(QuoteStatus.DRAFT);
    expect(quote.installationAddress).toBeNull();
    expect(quote.curtains).toEqual([]);
    expect(quote.generalAddOns).toEqual([]);
    expect(quote.discount.equals(Discount.noDiscount())).toBe(true);
    expect(quote.commercialAdjustmentCents).toBeNull();
    expect(quote.notes).toBeNull();
    expect(quote.createdAt).toBe(createdAt);
    expect(quote.updatedAt).toBe(updatedAt);
  });

  it('maps a complete draft with address, children and percentage discount', () => {
    const addOn = itemRecord({
      id: '55555555-5555-4555-8555-555555555555',
      name: 'Frete',
      quantity: '1.000000',
      unit: null,
      unitPriceCents: 5_000,
    });
    const record = quoteRecord({
      notes: 'Instalação urgente',
      installationAddressPostalCode: '01001000',
      installationAddressStreet: 'Rua das Flores',
      installationAddressNumber: '123',
      installationAddressComplement: 'Apto 10',
      installationAddressNeighborhood: 'Centro',
      installationAddressCity: 'São Paulo',
      installationAddressState: 'SP',
      discountType: DiscountType.PERCENTAGE,
      discountPercentage: 12.34,
      curtains: [
        curtainRecord(),
        curtainRecord({
          id: '66666666-6666-4666-8666-666666666666',
          sequence: 2,
          room: 'Quarto',
          components: [],
        }),
      ],
      generalAddOns: [addOn],
    });

    const quote = QuoteMapper.toDomain(record);

    expect(quote.notes).toBe('Instalação urgente');
    expect(quote.curtains).toHaveLength(2);
    expect(quote.curtains[0].id).toBe('22222222-2222-4222-8222-222222222222');
    expect(quote.curtains[0].openingWidth).toBe(2.65);
    expect(quote.curtains[0].borderValue).toBe(0.15);
    expect(quote.curtains[0].height).toBe(2.7);
    expect(quote.curtains[0].fabricFactor).toBe(3.5);
    expect(quote.curtains[0].components[0].quantity).toBe(8.05);
    expect(quote.curtains[0].components[0].unitPriceCents).toBe(3_000);
    expect(quote.generalAddOns[0].id).toBe(addOn.id);
    expect(quote.generalAddOns[0].quantity).toBe(1);
    expect(quote.discount.equals(Discount.percentage(12.34))).toBe(true);

    const address = InstallationAddress.create({
      postalCode: '01001000',
      street: 'Rua das Flores',
      number: '123',
      complement: 'Apto 10',
      neighborhood: 'Centro',
      city: 'São Paulo',
      state: 'SP',
    });

    expect(quote.installationAddress?.equals(address)).toBe(true);
  });

  it('maps a fixed discount and a negative adjustment', () => {
    const quote = QuoteMapper.toDomain(
      quoteRecord({
        discountType: DiscountType.FIXED_AMOUNT,
        discountFixedAmountCents: 15_000,
        commercialAdjustmentCents: -240,
      }),
    );

    expect(quote.discount.equals(Discount.fixedAmount(15_000))).toBe(true);
    expect(quote.commercialAdjustmentCents).toBe(-240);
  });

  it('maps an incomplete address without inventing values', () => {
    const quote = QuoteMapper.toDomain(
      quoteRecord({ installationAddressStreet: 'Rua das Flores' }),
    );

    expect(quote.installationAddress?.street).toBe('Rua das Flores');
    expect(quote.installationAddress?.number).toBeNull();
    expect(quote.installationAddress?.isComplete()).toBe(false);
  });

  it('maps every lifecycle date and terminal status', () => {
    const quote = QuoteMapper.toDomain(
      quoteRecord({
        status: QuoteStatus.COMPLETED,
        firstSentAt,
        validUntil,
        confirmedAt,
        productionStartedAt,
        scheduledInstallationAt,
        completedAt,
      }),
    );

    expect(quote.status).toBe(QuoteStatus.COMPLETED);
    expect(quote.firstSentAt).toBe(firstSentAt);
    expect(quote.validUntil).toBe(validUntil);
    expect(quote.confirmedAt).toBe(confirmedAt);
    expect(quote.productionStartedAt).toBe(productionStartedAt);
    expect(quote.scheduledInstallationAt).toBe(scheduledInstallationAt);
    expect(quote.completedAt).toBe(completedAt);
    expect(quote.isExpired(new Date('2026-12-01T00:00:00.000Z'))).toBe(false);
  });

  it('accepts decimal columns that expose only a string representation', () => {
    const decimal = (value: string) => ({ toString: () => value });
    const quote = QuoteMapper.toDomain(
      quoteRecord({
        discountType: DiscountType.PERCENTAGE,
        discountPercentage: decimal('5.50'),
        curtains: [
          curtainRecord({
            openingWidth: decimal('3.125'),
            components: [itemRecord({ quantity: decimal('1.500000') })],
          }),
        ],
      }),
    );

    expect(quote.discount.equals(Discount.percentage(5.5))).toBe(true);
    expect(quote.curtains[0].openingWidth).toBe(3.125);
    expect(quote.curtains[0].components[0].quantity).toBe(1.5);
  });

  it('maps the aggregate back to persistence columns', () => {
    const quote = QuoteMapper.toDomain(
      quoteRecord({
        status: QuoteStatus.SENT,
        notes: 'Observação',
        installationAddressStreet: 'Rua das Flores',
        installationAddressNumber: '123',
        installationAddressNeighborhood: 'Centro',
        installationAddressCity: 'São Paulo',
        discountType: DiscountType.PERCENTAGE,
        discountPercentage: 10,
        commercialAdjustmentCents: 500,
        firstSentAt,
        validUntil,
        curtains: [curtainRecord()],
        generalAddOns: [itemRecord({ name: 'Frete' })],
      }),
    );

    const data = QuoteMapper.toPersistence(quote);

    expect(data).toMatchObject({
      quoteNumber: 'ORÇ-2026-001',
      customerId: '44444444-4444-4444-8444-444444444444',
      status: QuoteStatus.SENT,
      notes: 'Observação',
      discountType: DiscountType.PERCENTAGE,
      discountPercentage: 10,
      commercialAdjustmentCents: 500,
      installationAddressStreet: 'Rua das Flores',
      installationAddressNumber: '123',
      installationAddressNeighborhood: 'Centro',
      installationAddressCity: 'São Paulo',
      installationAddressPostalCode: null,
      firstSentAt,
      validUntil,
      createdAt,
      updatedAt,
    });

    expect(QuoteMapper.curtainToPersistence(quote.curtains[0])).toEqual({
      id: '22222222-2222-4222-8222-222222222222',
      sequence: 1,
      room: 'Sala',
      description: null,
      material: 'Linho',
      openingWidth: 2.65,
      borderValue: 0.15,
      height: 2.7,
      fabricFactor: 3.5,
      notes: null,
    });

    expect(
      QuoteMapper.financialItemToPersistence(quote.generalAddOns[0]),
    ).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Frete',
      quantity: 8.05,
      unit: 'm',
      unitPriceCents: 3_000,
    });
  });

  it('round-trips without changing identities or values', () => {
    const quote = QuoteMapper.toDomain(
      quoteRecord({
        status: QuoteStatus.IN_PRODUCTION,
        installationAddressStreet: 'Rua das Flores',
        installationAddressNumber: '123',
        installationAddressNeighborhood: 'Centro',
        installationAddressCity: 'São Paulo',
        discountType: DiscountType.FIXED_AMOUNT,
        discountFixedAmountCents: 10_000,
        commercialAdjustmentCents: -240,
        firstSentAt,
        validUntil,
        confirmedAt,
        productionStartedAt,
        scheduledInstallationAt,
        curtains: [curtainRecord()],
        generalAddOns: [itemRecord({ name: 'Frete', quantity: '1.000000' })],
      }),
    );

    const roundTripped = QuoteMapper.toDomain(rebuildRecord(quote));

    expect(roundTripped.id).toBe(quote.id);
    expect(roundTripped.quoteNumber.equals(quote.quoteNumber)).toBe(true);
    expect(roundTripped.customerId).toBe(quote.customerId);
    expect(roundTripped.status).toBe(quote.status);
    expect(
      roundTripped.installationAddress?.equals(
        quote.installationAddress ?? null,
      ),
    ).toBe(true);
    expect(roundTripped.discount.equals(quote.discount)).toBe(true);
    expect(roundTripped.commercialAdjustmentCents).toBe(-240);
    expect(roundTripped.curtains[0].id).toBe(quote.curtains[0].id);
    expect(roundTripped.curtains[0].components[0].id).toBe(
      quote.curtains[0].components[0].id,
    );
    expect(roundTripped.curtains[0].components[0].quantity).toBe(8.05);
    expect(roundTripped.generalAddOns[0].id).toBe(quote.generalAddOns[0].id);
    expect(roundTripped.firstSentAt).toBe(firstSentAt);
    expect(roundTripped.productionStartedAt).toBe(productionStartedAt);
  });

  it('rejects unknown persisted statuses and discount types', () => {
    expect(() =>
      QuoteMapper.toDomain(quoteRecord({ status: 'UNKNOWN' })),
    ).toThrow(RangeError);
    expect(() =>
      QuoteMapper.toDomain(
        quoteRecord({
          discountType: 'UNKNOWN',
          discountPercentage: 10,
        }),
      ),
    ).toThrow(RangeError);
  });
});
