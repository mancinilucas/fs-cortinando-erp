import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { QuoteStatus } from '../../domain/entities/quote.js';
import { Discount, DiscountType } from '../../domain/value-objects/discount.js';
import { PrismaQuoteRepository } from '../../infrastructure/persistence/prisma-quote.repository.js';
import { PrismaQuoteSequence } from '../../infrastructure/persistence/prisma-quote-sequence.js';
import { PrismaCustomerEligibility } from '../../infrastructure/persistence/prisma-customer-eligibility.js';
import { QuoteCustomerNotFoundError } from '../errors/quote-customer-not-found.error.js';
import { CreateQuoteFromCustomerUseCase } from './create-quote-from-customer.use-case.js';

// Exercises the creation use case against the real PostgreSQL database.
describe('CreateQuoteFromCustomerUseCase integration', () => {
  // Reserved year bands; parallel integration specs use disjoint ranges.
  const mainYear = randomInt(1_700, 1_799);
  const otherYear = randomInt(1_800, 1_899);
  const rollbackYear = randomInt(1_900, 1_999);
  const years = [mainYear, otherYear, rollbackYear];
  const activeCustomerId = randomUUID();
  const deletedCustomerId = randomUUID();
  let prisma: PrismaService;
  let useCase: CreateQuoteFromCustomerUseCase;

  function useCaseAt(instant: Date): CreateQuoteFromCustomerUseCase {
    return new CreateQuoteFromCustomerUseCase(
      new PrismaQuoteRepository(prisma, new PrismaQuoteSequence(prisma)),
      new PrismaCustomerEligibility(prisma),
      { now: () => new Date(instant) },
    );
  }

  async function clearTestData(): Promise<void> {
    await prisma.quote.deleteMany({
      where: {
        OR: years.map((year) => ({
          quoteNumber: { startsWith: `ORÇ-${year}-` },
        })),
      },
    });
    await prisma.quoteSequence.deleteMany({ where: { year: { in: years } } });
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    useCase = useCaseAt(new Date(`${mainYear}-06-10T12:00:00.000Z`));

    await prisma.customer.createMany({
      data: [
        {
          id: activeCustomerId,
          name: `Quote Creation ${randomUUID()}`,
          phone: '11999999999',
        },
        {
          id: deletedCustomerId,
          name: `Quote Creation Deleted ${randomUUID()}`,
          phone: '11988888888',
          deletedAt: new Date(),
        },
      ],
    });
    await clearTestData();
  });

  afterAll(async () => {
    await clearTestData();
    await prisma.quote.deleteMany({
      where: { customerId: { in: [activeCustomerId, deletedCustomerId] } },
    });
    await prisma.customer.deleteMany({
      where: { id: { in: [activeCustomerId, deletedCustomerId] } },
    });
    await prisma.$disconnect();
  });

  it('rejects a customer that does not exist without consuming a number', async () => {
    const missing = useCaseAt(new Date(`${otherYear}-06-10T12:00:00.000Z`));

    await expect(
      missing.execute({ customerId: randomUUID() }),
    ).rejects.toBeInstanceOf(QuoteCustomerNotFoundError);

    expect(
      await prisma.quoteSequence.findUnique({ where: { year: otherYear } }),
    ).toBeNull();
  });

  it('rejects a soft-deleted customer without consuming a number', async () => {
    const missing = useCaseAt(new Date(`${otherYear}-06-10T12:00:00.000Z`));

    await expect(
      missing.execute({ customerId: deletedCustomerId }),
    ).rejects.toBeInstanceOf(QuoteCustomerNotFoundError);

    expect(
      await prisma.quoteSequence.findUnique({ where: { year: otherYear } }),
    ).toBeNull();
  });

  it('creates a minimal draft from an active customer', async () => {
    const quote = await useCase.execute({ customerId: activeCustomerId });

    expect(quote.status).toBe(QuoteStatus.DRAFT);
    expect(quote.customerId).toBe(activeCustomerId);
    expect(quote.quoteNumber.value).toMatch(
      new RegExp(`^ORÇ-${mainYear}-\\d{3,}$`),
    );
    expect(quote.installationAddress).toBeNull();
    expect(quote.discount.equals(Discount.noDiscount())).toBe(true);
    expect(quote.commercialAdjustmentCents).toBeNull();
    expect(quote.notes).toBeNull();
    expect(quote.curtains).toEqual([]);
    expect(quote.generalAddOns).toEqual([]);
    expect(quote.firstSentAt).toBeNull();
    expect(quote.validUntil).toBeNull();

    const row = await prisma.quote.findUniqueOrThrow({
      where: { id: quote.id },
    });
    const history = await prisma.quoteHistory.findMany({
      where: { quoteId: quote.id },
    });

    expect(row).toMatchObject({
      quoteNumber: quote.quoteNumber.value,
      customerId: activeCustomerId,
      status: 'DRAFT',
      notes: null,
    });
    expect(history).toHaveLength(1);
    expect(history[0].eventType).toBe('QUOTE_CREATED');
    expect(history[0].details).toEqual({
      quoteNumber: quote.quoteNumber.value,
    });
  });

  it('creates a complete draft and persists every child', async () => {
    const quote = await useCase.execute({
      customerId: activeCustomerId,
      notes: '  Instalação urgente  ',
      discount: { type: DiscountType.PERCENTAGE, percentage: 10 },
      commercialAdjustmentCents: -500,
      installationAddress: {
        postalCode: '01310-100',
        street: 'Avenida Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'sp',
      },
      curtains: [
        {
          room: 'Sala',
          material: 'Linho',
          openingWidth: 2.65,
          height: 2.7,
          components: [
            {
              name: 'Tecido',
              quantity: 8.05,
              unit: 'm',
              unitPriceCents: 3_000,
            },
          ],
        },
        {
          room: 'Quarto',
          components: [
            { name: 'Mão de obra', quantity: 1, unitPriceCents: 20_000 },
          ],
        },
      ],
      generalAddOns: [{ name: 'Frete', quantity: 1, unitPriceCents: 5_000 }],
    });

    expect(quote.notes).toBe('Instalação urgente');
    expect(quote.discount.equals(Discount.percentage(10))).toBe(true);
    expect(quote.commercialAdjustmentCents).toBe(-500);
    expect(quote.installationAddress?.postalCode).toBe('01310100');
    expect(quote.installationAddress?.state).toBe('SP');
    expect(quote.installationAddress?.isComplete()).toBe(true);
    expect(quote.curtains.map((curtain) => curtain.sequence)).toEqual([1, 2]);
    expect(quote.curtains[0].room).toBe('Sala');
    expect(quote.curtains[0].components[0].quantity).toBe(8.05);
    expect(quote.curtains[1].components[0].unitPriceCents).toBe(20_000);
    expect(quote.generalAddOns[0].name).toBe('Frete');

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: quote.id },
      include: {
        curtains: {
          orderBy: { sequence: 'asc' },
          include: { components: true },
        },
        generalAddOns: true,
      },
    });

    expect(stored.curtains).toHaveLength(2);
    expect(stored.curtains[0].components).toHaveLength(1);
    expect(Number(stored.curtains[0].openingWidth)).toBe(2.65);
    expect(stored.curtains[1].components[0].name).toBe('Mão de obra');
    expect(stored.generalAddOns).toHaveLength(1);
    expect(stored.discountType).toBe('PERCENTAGE');
    expect(stored.commercialAdjustmentCents).toBe(-500);
  });

  it('derives the commercial year in America/Sao_Paulo', async () => {
    // 02:00 UTC on January 1st is still December 31st in São Paulo.
    const nearNewYear = useCaseAt(
      new Date(`${otherYear + 1}-01-01T02:00:00.000Z`),
    );
    const quote = await nearNewYear.execute({
      customerId: activeCustomerId,
    });

    expect(quote.quoteNumber.value).toBe(`ORÇ-${otherYear}-001`);
  });

  it('rolls back the reserved number when the aggregate is invalid', async () => {
    const rollback = useCaseAt(new Date(`${rollbackYear}-06-10T12:00:00.000Z`));

    await expect(
      rollback.execute({
        customerId: activeCustomerId,
        curtains: [{ room: 'Sala', openingWidth: -1 }],
      }),
    ).rejects.toBeInstanceOf(RangeError);

    expect(
      await prisma.quoteSequence.findUnique({ where: { year: rollbackYear } }),
    ).toBeNull();
    expect(
      await prisma.quote.count({
        where: { quoteNumber: { startsWith: `ORÇ-${rollbackYear}-` } },
      }),
    ).toBe(0);
  });
});
