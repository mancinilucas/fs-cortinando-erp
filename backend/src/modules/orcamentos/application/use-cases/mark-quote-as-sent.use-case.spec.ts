import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { Quote, QuoteStatus } from '../../domain/entities/quote.js';
import {
  InvalidQuoteTransitionError,
  QuoteValidationError,
} from '../../domain/errors/quote-domain.errors.js';
import type { QuoteHistoryEventDraft } from '../../domain/history/quote-history.js';
import { PrismaQuoteRepository } from '../../infrastructure/persistence/prisma-quote.repository.js';
import { PrismaQuoteSequence } from '../../infrastructure/persistence/prisma-quote-sequence.js';
import { PrismaCustomerEligibility } from '../../infrastructure/persistence/prisma-customer-eligibility.js';
import { QuoteNotFoundError } from '../errors/quote-not-found.error.js';
import { MarkQuoteAsSentUseCase } from './mark-quote-as-sent.use-case.js';

interface SeedCurtainInput {
  room?: string | null;
  material?: string | null;
  openingWidth?: number | null;
  height?: number | null;
  borderValue?: number | null;
  fabricFactor?: number | null;
}

interface SeedComponentInput {
  name?: string;
  quantity?: number | null;
  unit?: string | null;
  unitPriceCents?: number | null;
}

interface SeedAddOnInput {
  name?: string;
  quantity?: number | null;
  unitPriceCents?: number | null;
}

interface SeedQuoteInput {
  customerId?: string;
  status?: 'DRAFT' | 'SENT' | 'CONFIRMED';
  addressComplete?: boolean;
  curtain?: SeedCurtainInput | null;
  component?: SeedComponentInput | null;
  addOn?: SeedAddOnInput | null;
  discountFixedAmountCents?: number | null;
  commercialAdjustmentCents?: number | null;
}

const DEFAULT_CURTAIN: Required<SeedCurtainInput> = {
  room: 'Sala',
  material: 'Linho',
  openingWidth: 2.6,
  height: 2.6,
  borderValue: 0.15,
  fabricFactor: 3.5,
};

const DEFAULT_COMPONENT: Required<SeedComponentInput> = {
  name: 'Tecido',
  quantity: 8.05,
  unit: 'm',
  unitPriceCents: 3_000,
};

const DEFAULT_ADD_ON: Required<SeedAddOnInput> = {
  name: 'Frete',
  quantity: 1,
  unitPriceCents: 5_000,
};

// Forced persistence failure: Prisma cannot serialize the circular payload,
// so the transaction that writes the state change and history rolls back.
class CircularHistoryRepository extends PrismaQuoteRepository {
  override async save(
    quote: Quote,
    event: QuoteHistoryEventDraft,
  ): Promise<void> {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await super.save(quote, {
      ...event,
      details: circular,
    } as unknown as QuoteHistoryEventDraft);
  }
}

describe('MarkQuoteAsSentUseCase integration', () => {
  const year = randomInt(4_000, 4_999);
  const now = new Date('2026-10-19T12:00:00.000Z');
  const defaultValidUntil = new Date('2026-11-18T12:00:00.000Z');
  const activeCustomerId = randomUUID();
  const deletedCustomerId = randomUUID();
  let prisma: PrismaService;
  let useCase: MarkQuoteAsSentUseCase;
  let quoteCounter = 0;

  function nextQuoteNumber(): string {
    quoteCounter += 1;

    return `ORÇ-${year}-${String(quoteCounter).padStart(3, '0')}`;
  }

  async function seedQuote(
    input: SeedQuoteInput = {},
  ): Promise<{ id: string }> {
    const id = randomUUID();
    const hasCurtain = input.curtain !== null;
    const hasComponent = input.component !== null;
    const hasAddOn = input.addOn !== null;
    const addressComplete = input.addressComplete ?? true;

    await prisma.quote.create({
      data: {
        id,
        quoteNumber: nextQuoteNumber(),
        customerId: input.customerId ?? activeCustomerId,
        status: input.status ?? 'DRAFT',
        installationAddressPostalCode: addressComplete ? '01310100' : null,
        installationAddressStreet: 'Avenida Paulista',
        installationAddressNumber: '1000',
        installationAddressNeighborhood: 'Bela Vista',
        installationAddressCity: addressComplete ? 'São Paulo' : null,
        installationAddressState: 'SP',
        discountType:
          input.discountFixedAmountCents === null ||
          input.discountFixedAmountCents === undefined
            ? 'NO_DISCOUNT'
            : 'FIXED_AMOUNT',
        discountFixedAmountCents: input.discountFixedAmountCents ?? null,
        commercialAdjustmentCents: input.commercialAdjustmentCents ?? null,
        curtains: hasCurtain
          ? {
              create: {
                id: randomUUID(),
                sequence: 1,
                ...DEFAULT_CURTAIN,
                ...input.curtain,
                components: hasComponent
                  ? {
                      create: {
                        id: randomUUID(),
                        ...DEFAULT_COMPONENT,
                        ...input.component,
                      },
                    }
                  : undefined,
              },
            }
          : undefined,
        generalAddOns: hasAddOn
          ? {
              create: {
                id: randomUUID(),
                ...DEFAULT_ADD_ON,
                ...input.addOn,
              },
            }
          : undefined,
      },
    });

    return { id };
  }

  function historyOf(quoteId: string) {
    return prisma.quoteHistory.findMany({
      where: { quoteId },
      orderBy: { occurredAt: 'asc' },
    });
  }

  async function expectDraftUntouched(quoteId: string): Promise<void> {
    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: quoteId },
    });

    expect(stored.status).toBe('DRAFT');
    expect(stored.firstSentAt).toBeNull();
    expect(stored.validUntil).toBeNull();
    expect(await historyOf(quoteId)).toHaveLength(0);
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const repository = new PrismaQuoteRepository(
      prisma,
      new PrismaQuoteSequence(prisma),
    );

    useCase = new MarkQuoteAsSentUseCase(
      repository,
      new PrismaCustomerEligibility(prisma),
      { now: () => new Date(now) },
    );

    await prisma.customer.createMany({
      data: [
        {
          id: activeCustomerId,
          name: `Quote Send ${randomUUID()}`,
          phone: '11999999999',
        },
        {
          id: deletedCustomerId,
          name: `Quote Send Deleted ${randomUUID()}`,
          phone: '11988888888',
          deletedAt: new Date(),
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.quote.deleteMany({
      where: { customerId: { in: [activeCustomerId, deletedCustomerId] } },
    });
    await prisma.customer.deleteMany({
      where: { id: { in: [activeCustomerId, deletedCustomerId] } },
    });
    await prisma.$disconnect();
  });

  it('rejects a quote that does not exist', async () => {
    await expect(useCase.execute({ id: randomUUID() })).rejects.toBeInstanceOf(
      QuoteNotFoundError,
    );
  });

  it('sends a complete draft with the default validity', async () => {
    const seeded = await seedQuote();

    const quote = await useCase.execute({ id: seeded.id });

    expect(quote.status).toBe(QuoteStatus.SENT);
    expect(quote.firstSentAt?.toISOString()).toBe(now.toISOString());
    expect(quote.validUntil?.toISOString()).toBe(
      defaultValidUntil.toISOString(),
    );

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });
    const history = await historyOf(seeded.id);

    expect(stored.status).toBe('SENT');
    expect(stored.firstSentAt?.toISOString()).toBe(now.toISOString());
    expect(stored.validUntil?.toISOString()).toBe(
      defaultValidUntil.toISOString(),
    );
    expect(history).toHaveLength(1);
    expect(history[0].eventType).toBe('QUOTE_SENT');
    expect(history[0].details).toEqual({
      validUntil: defaultValidUntil.toISOString(),
      firstSend: true,
    });
  });

  it('applies an explicitly informed future validity', async () => {
    const seeded = await seedQuote();
    const customValidUntil = new Date('2026-12-01T00:00:00.000Z');

    await useCase.execute({ id: seeded.id, validUntil: customValidUntil });

    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: seeded.id },
    });
    const history = await historyOf(seeded.id);

    expect(stored.validUntil?.toISOString()).toBe(
      customValidUntil.toISOString(),
    );
    expect(history[0].details).toEqual({
      validUntil: customValidUntil.toISOString(),
      firstSend: true,
    });
  });

  it('rejects a validity that is not strictly in the future', async () => {
    const seeded = await seedQuote();

    const error = await useCase
      .execute({
        id: seeded.id,
        validUntil: new Date('2026-10-18T12:00:00.000Z'),
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(QuoteValidationError);
    expect(
      (error as QuoteValidationError).violations.map((item) => item.code),
    ).toContain('VALID_UNTIL_NOT_FUTURE');
    await expectDraftUntouched(seeded.id);
  });

  const gateCases: { name: string; seed: SeedQuoteInput; code: string }[] = [
    {
      name: 'an incomplete installation address',
      seed: { addressComplete: false },
      code: 'INSTALLATION_ADDRESS_INCOMPLETE',
    },
    {
      name: 'a quote without curtains',
      seed: { curtain: null },
      code: 'NO_CURTAINS',
    },
    {
      name: 'a curtain without a room',
      seed: { curtain: { room: null } },
      code: 'CURTAIN_ROOM_REQUIRED',
    },
    {
      name: 'a curtain without a material',
      seed: { curtain: { material: null } },
      code: 'CURTAIN_MATERIAL_REQUIRED',
    },
    {
      name: 'a curtain without an opening width',
      seed: { curtain: { openingWidth: null } },
      code: 'CURTAIN_OPENING_WIDTH_INVALID',
    },
    {
      name: 'a curtain without a height',
      seed: { curtain: { height: null } },
      code: 'CURTAIN_HEIGHT_INVALID',
    },
    {
      name: 'a curtain without a border',
      seed: { curtain: { borderValue: null } },
      code: 'CURTAIN_BORDER_INVALID',
    },
    {
      name: 'a curtain without a fabric factor',
      seed: { curtain: { fabricFactor: null } },
      code: 'CURTAIN_FABRIC_FACTOR_INVALID',
    },
    {
      name: 'a curtain without components',
      seed: { component: null },
      code: 'CURTAIN_COMPONENT_REQUIRED',
    },
    {
      name: 'an incomplete component',
      seed: { component: { unitPriceCents: null } },
      code: 'COMPONENT_INVALID',
    },
    {
      name: 'an incomplete general add-on',
      seed: { addOn: { quantity: null } },
      code: 'GENERAL_ADD_ON_INVALID',
    },
    {
      name: 'a fixed discount above the subtotal',
      seed: { discountFixedAmountCents: 50_000 },
      code: 'DISCOUNT_EXCEEDS_SUBTOTAL',
    },
    {
      name: 'a commercial adjustment that makes the total non-positive',
      seed: { commercialAdjustmentCents: -100_000 },
      code: 'TOTAL_NOT_POSITIVE',
    },
  ];

  it.each(gateCases)('rejects $name', async ({ seed, code }) => {
    const seeded = await seedQuote(seed);

    const error = await useCase
      .execute({ id: seeded.id })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(QuoteValidationError);
    expect(
      (error as QuoteValidationError).violations.map((item) => item.code),
    ).toContain(code);
    await expectDraftUntouched(seeded.id);
  });

  it('blocks sending when the customer was removed after the draft', async () => {
    const seeded = await seedQuote({ customerId: deletedCustomerId });

    const error = await useCase
      .execute({ id: seeded.id })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(QuoteValidationError);
    expect(
      (error as QuoteValidationError).violations.map((item) => item.code),
    ).toEqual(['CUSTOMER_NOT_ACTIVE']);
    await expectDraftUntouched(seeded.id);
  });

  it('rejects a quote that is not DRAFT', async () => {
    const seeded = await seedQuote({ status: 'SENT' });

    await expect(useCase.execute({ id: seeded.id })).rejects.toBeInstanceOf(
      InvalidQuoteTransitionError,
    );
  });

  it('rolls the transition back when persistence fails', async () => {
    const seeded = await seedQuote();
    const failingUseCase = new MarkQuoteAsSentUseCase(
      new CircularHistoryRepository(prisma, new PrismaQuoteSequence(prisma)),
      new PrismaCustomerEligibility(prisma),
      { now: () => new Date(now) },
    );

    await expect(failingUseCase.execute({ id: seeded.id })).rejects.toThrow();
    await expectDraftUntouched(seeded.id);
  });
});
