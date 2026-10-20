import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import {
  DiscountType,
  QuoteStatus,
} from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { Discount } from '../../domain/value-objects/discount.js';
import { PrismaQuoteRepository } from './prisma-quote.repository.js';
import { PrismaQuoteSequence } from './prisma-quote-sequence.js';

// Exercises aggregate loading against the real PostgreSQL database.
describe('PrismaQuoteRepository integration — loading', () => {
  const customerId = randomUUID();
  let prisma: PrismaService;
  let repository: PrismaQuoteRepository;
  let quoteCounter = 0;

  function nextQuoteNumber(): string {
    quoteCounter += 1;

    return `ORÇ-2100-${String(quoteCounter).padStart(3, '0')}`;
  }

  function quoteData(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      id: randomUUID(),
      quoteNumber: nextQuoteNumber(),
      customerId,
      status: QuoteStatus.DRAFT,
      ...overrides,
    };
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaQuoteRepository(
      prisma,
      new PrismaQuoteSequence(prisma),
    );

    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Quote Repository ${randomUUID()}`,
        phone: '11999999999',
      },
    });
  });

  afterAll(async () => {
    await prisma.quote.deleteMany({ where: { customerId } });
    await prisma.customer.delete({ where: { id: customerId } });
    await prisma.$disconnect();
  });

  it('returns null when the quote does not exist', async () => {
    await expect(repository.findById(randomUUID())).resolves.toBeNull();
  });

  it('loads a quote without children', async () => {
    const record = await prisma.quote.create({ data: quoteData() });

    const quote = await repository.findById(record.id);

    expect(quote).not.toBeNull();
    expect(quote?.id).toBe(record.id);
    expect(quote?.quoteNumber.value).toBe(record.quoteNumber);
    expect(quote?.customerId).toBe(customerId);
    expect(quote?.status).toBe('DRAFT');
    expect(quote?.curtains).toEqual([]);
    expect(quote?.generalAddOns).toEqual([]);
    expect(quote?.installationAddress).toBeNull();
  });

  it('loads multiple curtains ordered by sequence', async () => {
    const record = await prisma.quote.create({
      data: quoteData({
        curtains: {
          create: [
            { sequence: 2, room: 'Quarto' },
            { sequence: 1, room: 'Sala' },
          ],
        },
      }),
    });

    const quote = await repository.findById(record.id);

    expect(quote?.curtains.map((curtain) => curtain.sequence)).toEqual([1, 2]);
    expect(quote?.curtains.map((curtain) => curtain.room)).toEqual([
      'Sala',
      'Quarto',
    ]);
  });

  it('loads multiple components of a curtain', async () => {
    const componentId = randomUUID();
    const record = await prisma.quote.create({
      data: quoteData({
        curtains: {
          create: [
            {
              sequence: 1,
              components: {
                create: [
                  {
                    id: componentId,
                    name: 'Tecido',
                    quantity: '8.050000',
                    unit: 'm',
                    unitPriceCents: 3_000,
                  },
                  { name: 'Mão de obra', quantity: '1.000000' },
                ],
              },
            },
          ],
        },
      }),
    });

    const quote = await repository.findById(record.id);
    const components = quote?.curtains[0].components ?? [];

    expect(components).toHaveLength(2);
    expect(components[0].id).toBe(componentId);
    expect(components[0].name).toBe('Tecido');
    expect(components[0].quantity).toBe(8.05);
    expect(components[0].unitPriceCents).toBe(3_000);
    expect(components[1].name).toBe('Mão de obra');
    expect(components[1].unitPriceCents).toBeNull();
  });

  it('loads general add-ons', async () => {
    const record = await prisma.quote.create({
      data: quoteData({
        generalAddOns: {
          create: [
            { name: 'Frete', quantity: '1.000000', unitPriceCents: 5_000 },
            { name: 'Instalação', quantity: '2.000000', unitPriceCents: 7_500 },
          ],
        },
      }),
    });

    const quote = await repository.findById(record.id);

    expect(quote?.generalAddOns).toHaveLength(2);
    expect(quote?.generalAddOns.map((addOn) => addOn.name)).toEqual([
      'Frete',
      'Instalação',
    ]);
    expect(quote?.generalAddOns[1].quantity).toBe(2);
    expect(quote?.generalAddOns[1].unitPriceCents).toBe(7_500);
  });

  it('loads the installation address', async () => {
    const record = await prisma.quote.create({
      data: quoteData({
        installationAddressPostalCode: '01001000',
        installationAddressStreet: 'Rua das Flores',
        installationAddressNumber: '123',
        installationAddressComplement: 'Apto 10',
        installationAddressNeighborhood: 'Centro',
        installationAddressCity: 'São Paulo',
        installationAddressState: 'SP',
      }),
    });

    const quote = await repository.findById(record.id);

    expect(quote?.installationAddress?.postalCode).toBe('01001000');
    expect(quote?.installationAddress?.street).toBe('Rua das Flores');
    expect(quote?.installationAddress?.number).toBe('123');
    expect(quote?.installationAddress?.complement).toBe('Apto 10');
    expect(quote?.installationAddress?.neighborhood).toBe('Centro');
    expect(quote?.installationAddress?.city).toBe('São Paulo');
    expect(quote?.installationAddress?.state).toBe('SP');
    expect(quote?.installationAddress?.isComplete()).toBe(true);
  });

  it('loads the discount and the commercial adjustment', async () => {
    const record = await prisma.quote.create({
      data: quoteData({
        discountType: DiscountType.PERCENTAGE,
        discountPercentage: '12.34',
        commercialAdjustmentCents: -240,
      }),
    });

    const quote = await repository.findById(record.id);

    expect(quote?.discount.equals(Discount.percentage(12.34))).toBe(true);
    expect(quote?.commercialAdjustmentCents).toBe(-240);
  });

  it('loads terminal quotes with their lifecycle dates', async () => {
    const firstSentAt = new Date('2026-10-01T12:00:00.000Z');
    const validUntil = new Date('2026-10-31T12:00:00.000Z');
    const confirmedAt = new Date('2026-10-05T12:00:00.000Z');
    const productionStartedAt = new Date('2026-10-06T12:00:00.000Z');
    const scheduledInstallationAt = new Date('2026-10-20T12:00:00.000Z');
    const completedAt = new Date('2026-10-21T12:00:00.000Z');
    const record = await prisma.quote.create({
      data: quoteData({
        status: QuoteStatus.COMPLETED,
        firstSentAt,
        validUntil,
        confirmedAt,
        productionStartedAt,
        scheduledInstallationAt,
        completedAt,
      }),
    });

    const quote = await repository.findById(record.id);

    expect(quote?.status).toBe('COMPLETED');
    expect(quote?.firstSentAt).toEqual(firstSentAt);
    expect(quote?.validUntil).toEqual(validUntil);
    expect(quote?.confirmedAt).toEqual(confirmedAt);
    expect(quote?.productionStartedAt).toEqual(productionStartedAt);
    expect(quote?.scheduledInstallationAt).toEqual(scheduledInstallationAt);
    expect(quote?.completedAt).toEqual(completedAt);
  });

  it('does not load history with the aggregate', async () => {
    const record = await prisma.quote.create({
      data: quoteData({
        history: {
          create: [
            {
              eventType: 'QUOTE_CREATED',
              details: { quoteNumber: 'ORÇ-2100-001' },
            },
          ],
        },
      }),
      include: { history: true },
    });

    const quote = await repository.findById(record.id);

    expect(record.history).toHaveLength(1);
    expect(quote).not.toBeNull();
    expect(
      (quote as unknown as Record<string, unknown>).history,
    ).toBeUndefined();
  });
});
