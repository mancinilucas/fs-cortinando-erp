import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { InvalidQuoteTransitionError } from '../../domain/errors/quote-domain.errors.js';
import { PrismaCustomerEligibility } from '../../infrastructure/persistence/prisma-customer-eligibility.js';
import { PrismaQuoteRepository } from '../../infrastructure/persistence/prisma-quote.repository.js';
import { PrismaQuoteSequence } from '../../infrastructure/persistence/prisma-quote-sequence.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { CreateQuoteFromCustomerUseCase } from './create-quote-from-customer.use-case.js';
import { DeleteDraftQuoteUseCase } from './delete-draft-quote.use-case.js';

type SeedStatus =
  'DRAFT' | 'SENT' | 'CONFIRMED' | 'IN_PRODUCTION' | 'COMPLETED' | 'CANCELLED';

describe('DeleteDraftQuoteUseCase integration', () => {
  const seedYear = randomInt(5_000, 5_999);
  const numberYear = randomInt(6_000, 6_999);
  const customerId = randomUUID();
  let prisma: PrismaService;
  let repository: PrismaQuoteRepository;
  let useCase: DeleteDraftQuoteUseCase;
  let createUseCase: CreateQuoteFromCustomerUseCase;
  let quoteCounter = 0;

  function nextQuoteNumber(): string {
    quoteCounter += 1;

    return `ORÇ-${seedYear}-${String(quoteCounter).padStart(3, '0')}`;
  }

  async function seedQuote(status: SeedStatus): Promise<{ id: string }> {
    const id = randomUUID();

    await prisma.quote.create({
      data: {
        id,
        quoteNumber: nextQuoteNumber(),
        customerId,
        status,
        curtains: {
          create: [
            {
              sequence: 1,
              room: 'Sala',
              components: {
                create: [
                  {
                    name: 'Tecido',
                    quantity: 8.05,
                    unit: 'm',
                    unitPriceCents: 3_000,
                  },
                ],
              },
            },
          ],
        },
        generalAddOns: {
          create: [{ name: 'Instalação', quantity: 1, unitPriceCents: 5_000 }],
        },
        history: {
          create: [
            {
              eventType: 'QUOTE_CREATED',
              details: { quoteNumber: `ORÇ-${seedYear}-${quoteCounter}` },
            },
          ],
        },
      },
    });

    return { id };
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    repository = new PrismaQuoteRepository(
      prisma,
      new PrismaQuoteSequence(prisma),
    );
    useCase = new DeleteDraftQuoteUseCase(repository);
    createUseCase = new CreateQuoteFromCustomerUseCase(
      repository,
      new PrismaCustomerEligibility(prisma),
      {
        now: () => new Date(`${numberYear}-06-10T12:00:00.000Z`),
      },
    );

    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Quote Delete ${randomUUID()}`,
        phone: '11999999999',
      },
    });
  });

  afterAll(async () => {
    await prisma.quote.deleteMany({ where: { customerId } });
    await prisma.quoteSequence.deleteMany({
      where: { year: { in: [seedYear, numberYear] } },
    });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.$disconnect();
  });

  it('rejects a quote that does not exist', async () => {
    await expect(useCase.execute({ id: randomUUID() })).rejects.toBeInstanceOf(
      QuoteNotFoundError,
    );
  });

  it('deletes a DRAFT with its children and history', async () => {
    const seeded = await seedQuote('DRAFT');
    const curtain = await prisma.curtain.findFirstOrThrow({
      where: { quoteId: seeded.id },
    });

    await useCase.execute({ id: seeded.id });

    expect(
      await prisma.quote.findUnique({ where: { id: seeded.id } }),
    ).toBeNull();
    expect(await prisma.curtain.count({ where: { quoteId: seeded.id } })).toBe(
      0,
    );
    expect(
      await prisma.financialComponent.count({
        where: { curtainId: curtain.id },
      }),
    ).toBe(0);
    expect(
      await prisma.generalAddOn.count({ where: { quoteId: seeded.id } }),
    ).toBe(0);
    expect(
      await prisma.quoteHistory.count({ where: { quoteId: seeded.id } }),
    ).toBe(0);
  });

  it('does not reuse the number of a deleted draft', async () => {
    const first = await createUseCase.execute({ customerId });

    await useCase.execute({ id: first.id });

    const second = await createUseCase.execute({ customerId });

    expect(second.quoteNumber.sequence).toBe(first.quoteNumber.sequence + 1);
    expect(second.quoteNumber.value).not.toBe(first.quoteNumber.value);
  });

  it.each([
    'SENT',
    'CONFIRMED',
    'IN_PRODUCTION',
    'COMPLETED',
    'CANCELLED',
  ] as const)('rejects deletion of a %s quote', async (status) => {
    const seeded = await seedQuote(status);

    await expect(useCase.execute({ id: seeded.id })).rejects.toBeInstanceOf(
      InvalidQuoteTransitionError,
    );

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });

    expect(stored.status).toBe(status);
    expect(
      await prisma.quoteHistory.count({ where: { quoteId: seeded.id } }),
    ).toBe(1);
  });
});
