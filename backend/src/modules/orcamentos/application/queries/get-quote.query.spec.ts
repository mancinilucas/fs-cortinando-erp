import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { QuoteRepository } from '../../domain/repositories/quote.repository.js';
import { PrismaQuoteRepository } from '../../infrastructure/persistence/prisma-quote.repository.js';
import { PrismaQuoteSequence } from '../../infrastructure/persistence/prisma-quote-sequence.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { GetQuoteQuery } from './get-quote.query.js';

describe('GetQuoteQuery integration', () => {
  const year = randomInt(7_000, 7_999);
  const now = new Date('2026-10-19T12:00:00.000Z');
  const customerId = randomUUID();
  let prisma: PrismaService;
  let repository: QuoteRepository;
  let query: GetQuoteQuery;
  let quoteCounter = 0;

  function nextQuoteNumber(): string {
    quoteCounter += 1;

    return `ORÇ-${year}-${String(quoteCounter).padStart(3, '0')}`;
  }

  async function seedRichQuote(): Promise<string> {
    const id = randomUUID();

    await prisma.quote.create({
      data: {
        id,
        quoteNumber: nextQuoteNumber(),
        customerId,
        status: 'CONFIRMED',
        notes: 'Observação do orçamento',
        discountType: 'PERCENTAGE',
        discountPercentage: 10,
        commercialAdjustmentCents: -500,
        installationAddressPostalCode: '01001000',
        installationAddressStreet: 'Rua das Flores',
        installationAddressNumber: '123',
        installationAddressComplement: 'Apto 45',
        installationAddressNeighborhood: 'Centro',
        installationAddressCity: 'São Paulo',
        installationAddressState: 'SP',
        scheduledInstallationAt: new Date('2026-10-10T09:00:00.000Z'),
        curtains: {
          create: [
            {
              sequence: 1,
              room: 'Sala',
              description: 'Cortina principal',
              material: 'Linho',
              openingWidth: 2.5,
              borderValue: 0.15,
              height: 2.7,
              fabricFactor: 3.5,
              notes: 'Sob medida',
              components: {
                create: [
                  {
                    name: 'Tecido',
                    quantity: 8.05,
                    unit: 'm',
                    unitPriceCents: 3_000,
                  },
                  {
                    name: 'Argola',
                    quantity: 10,
                    unit: 'un',
                    unitPriceCents: 200,
                  },
                ],
              },
            },
          ],
        },
        generalAddOns: {
          create: [
            {
              name: 'Instalação',
              quantity: 1,
              unit: 'serviço',
              unitPriceCents: 15_000,
            },
          ],
        },
      },
    });

    return id;
  }

  async function seedStatusQuote(
    status: 'SENT' | 'CONFIRMED' | 'COMPLETED',
    extra: { validUntil?: Date; scheduledInstallationAt?: Date },
  ): Promise<string> {
    const id = randomUUID();

    await prisma.quote.create({
      data: {
        id,
        quoteNumber: nextQuoteNumber(),
        customerId,
        status,
        ...extra,
      },
    });

    return id;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    repository = new PrismaQuoteRepository(
      prisma,
      new PrismaQuoteSequence(prisma),
    );
    query = new GetQuoteQuery(repository, { now: () => new Date(now) });

    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Quote Detail ${randomUUID()}`,
        phone: '11999999999',
      },
    });
  });

  afterAll(async () => {
    await prisma.quote.deleteMany({ where: { customerId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.$disconnect();
  });

  it('rejects a quote that does not exist', async () => {
    await expect(query.execute({ id: randomUUID() })).rejects.toBeInstanceOf(
      QuoteNotFoundError,
    );
  });

  it('projects the detail and keeps totals in parity with the domain', async () => {
    const id = await seedRichQuote();
    const domain = await repository.findById(id);

    if (domain === null) {
      throw new Error('Seeded quote was not found');
    }

    const view = await query.execute({ id });

    expect(view.id).toBe(id);
    expect(view.quoteNumber).toBe(domain.quoteNumber.value);
    expect(view.customerId).toBe(customerId);
    expect(view.status).toBe(domain.status);
    expect(view.notes).toBe('Observação do orçamento');
    expect(view.discount).toEqual({
      type: 'PERCENTAGE',
      percentage: 10,
      fixedAmountCents: null,
    });
    expect(view.commercialAdjustmentCents).toBe(-500);
    expect(view.installationAddress).toEqual({
      postalCode: '01001000',
      street: 'Rua das Flores',
      number: '123',
      complement: 'Apto 45',
      neighborhood: 'Centro',
      city: 'São Paulo',
      state: 'SP',
    });

    const curtain = view.curtains[0];
    const domainCurtain = domain.curtains[0];

    expect(curtain.sequence).toBe(1);
    expect(curtain.room).toBe('Sala');
    expect(curtain.material).toBe('Linho');
    expect(curtain.finalWidth).toBe(domainCurtain.finalWidth);
    expect(curtain.fabricQuantity).toBe(domainCurtain.fabricQuantity);
    expect(curtain.totalCents).toBe(domainCurtain.financialTotalCents);
    expect(curtain.components.map((item) => item.totalCents)).toEqual(
      domainCurtain.components.map((item) => item.totalCents),
    );
    expect(view.generalAddOns[0].totalCents).toBe(
      domain.generalAddOns[0].totalCents,
    );

    expect(view.totals).toEqual({
      curtainsSubtotalCents: domain.curtainsSubtotalCents,
      generalAddOnsSubtotalCents: domain.generalAddOnsSubtotalCents,
      subtotalCents: domain.subtotalCents,
      discountValueCents: domain.discountValueCents,
      calculatedTotalCents: domain.calculatedTotalCents,
      commercialAdjustmentCents: domain.effectiveCommercialAdjustmentCents,
      totalCents: domain.totalCents,
    });
    expect(view.totals).toEqual({
      curtainsSubtotalCents: 26_150,
      generalAddOnsSubtotalCents: 15_000,
      subtotalCents: 41_150,
      discountValueCents: 4_115,
      calculatedTotalCents: 37_035,
      commercialAdjustmentCents: -500,
      totalCents: 36_535,
    });

    expect(view.expired).toBe(domain.isExpired(now));
    expect(view.lateInstallation).toBe(domain.isLateInstallation(now));
    expect(view.lateInstallation).toBe(true);
    expect(view.createdAt).toEqual(domain.createdAt);
    expect(view.updatedAt).toEqual(domain.updatedAt);
  });

  it('derives expiration and late installation without persisting them', async () => {
    const expiredId = await seedStatusQuote('SENT', {
      validUntil: new Date('2026-10-18T12:00:00.000Z'),
    });
    const validId = await seedStatusQuote('SENT', {
      validUntil: new Date('2026-10-20T12:00:00.000Z'),
    });
    const lateId = await seedStatusQuote('CONFIRMED', {
      scheduledInstallationAt: new Date('2026-10-10T09:00:00.000Z'),
    });
    const completedId = await seedStatusQuote('COMPLETED', {
      scheduledInstallationAt: new Date('2026-10-10T09:00:00.000Z'),
    });

    const expired = await query.execute({ id: expiredId });
    const valid = await query.execute({ id: validId });
    const late = await query.execute({ id: lateId });
    const completed = await query.execute({ id: completedId });

    expect(expired.expired).toBe(true);
    expect(valid.expired).toBe(false);
    expect(late.lateInstallation).toBe(true);
    expect(completed.lateInstallation).toBe(false);
  });
});
