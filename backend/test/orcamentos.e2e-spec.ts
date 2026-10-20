import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { Argon2PasswordHasher } from '../src/modules/auth/infrastructure/argon2-password-hasher.js';
import { sessionCookieName } from '../src/modules/auth/presentation/session-cookie.js';
import { PrismaService } from '../src/shared/database/prisma.service.js';

// End-to-end coverage of the main quote commercial lifecycle (ORCAMENTO-43).
// Every step travels the real HTTP -> Application -> Domain -> Prisma path:
// login, customer creation, draft composition, sending, confirmation,
// production, installation and completion, followed by the negative flows
// described in the task.

const ORIGIN = 'http://localhost:5173';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const QUOTE_NUMBER = /^ORÇ-\d{4}-\d{3,}$/;

const COMPLETE_ADDRESS = {
  postalCode: '01310-100',
  street: 'Avenida Paulista',
  number: '1000',
  complement: 'Apto 10',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
};

interface QuoteFinancialItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  unitPriceCents: number | null;
  totalCents: number | null;
}

interface QuoteCurtain {
  id: string;
  sequence: number;
  room: string | null;
  description: string | null;
  material: string | null;
  openingWidth: number | null;
  borderValue: number | null;
  finalWidth: number | null;
  height: number | null;
  fabricFactor: number | null;
  fabricQuantity: number | null;
  notes: string | null;
  components: QuoteFinancialItem[];
  totalCents: number;
}

interface QuoteTotals {
  curtainsSubtotalCents: number;
  generalAddOnsSubtotalCents: number;
  subtotalCents: number;
  discountValueCents: number;
  calculatedTotalCents: number;
  commercialAdjustmentCents: number;
  totalCents: number;
}

interface QuoteDetail {
  id: string;
  quoteNumber: string;
  customerId: string;
  status: string;
  notes: string | null;
  discount: {
    type: string;
    percentage: number | null;
    fixedAmountCents: number | null;
  };
  commercialAdjustmentCents: number | null;
  installationAddress: Record<string, string | null> | null;
  curtains: QuoteCurtain[];
  generalAddOns: QuoteFinancialItem[];
  totals: QuoteTotals;
  createdAt: string;
  updatedAt: string;
  firstSentAt: string | null;
  validUntil: string | null;
  confirmedAt: string | null;
  productionStartedAt: string | null;
  scheduledInstallationAt: string | null;
  completedAt: string | null;
  expired: boolean;
  lateInstallation: boolean;
}

interface QuoteHistoryEntry {
  id: string;
  eventType: string;
  occurredAt: string;
  details: {
    quoteNumber?: string;
    validUntil?: string;
    firstSend?: boolean;
    changes?: { field: string; previous: unknown; next: unknown }[];
    scheduledInstallationAt?: string;
  } | null;
}

const ZERO_TOTALS: QuoteTotals = {
  curtainsSubtotalCents: 0,
  generalAddOnsSubtotalCents: 0,
  subtotalCents: 0,
  discountValueCents: 0,
  calculatedTotalCents: 0,
  commercialAdjustmentCents: 0,
  totalCents: 0,
};

describe('Quotes (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookie: string;
  let userId: string | null = null;
  let originalAppOrigin: string | undefined;
  let customerIds: string[];

  const email = `e2e-orcamentos-${randomUUID()}@example.com`;
  const password = `pw-${randomUUID()}`;

  beforeAll(async () => {
    originalAppOrigin = process.env.APP_ORIGIN;
    process.env.APP_ORIGIN = ORIGIN;

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Mirror the bootstrap configuration in main.ts.
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    userId = (
      await prisma.user.create({
        data: {
          email,
          passwordHash: await new Argon2PasswordHasher().hash(password),
        },
      })
    ).id;

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', ORIGIN)
      .send({ email, password })
      .expect(200);

    const prefix = `${sessionCookieName()}=`;
    const session = (
      loginResponse.headers['set-cookie'] as string[] | undefined
    )?.find((value) => value.startsWith(prefix));

    if (!session) {
      throw new Error('session cookie was not set');
    }

    cookie = session.slice(0, session.indexOf(';'));
  }, 30_000);

  beforeEach(() => {
    customerIds = [];
  });

  afterEach(async () => {
    if (customerIds.length > 0) {
      // Quote -> Customer is Restrict; quotes are removed first and their
      // children/history cascade from the quote itself.
      await prisma.quote.deleteMany({
        where: { customerId: { in: customerIds } },
      });
      await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    }
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await app.close();

    if (originalAppOrigin === undefined) {
      delete process.env.APP_ORIGIN;
    } else {
      process.env.APP_ORIGIN = originalAppOrigin;
    }
  });

  function server() {
    return app.getHttpServer();
  }

  function onlyCurtain(quote: QuoteDetail): QuoteCurtain {
    const [curtain] = quote.curtains;

    if (curtain === undefined) {
      throw new Error('quote has no curtain');
    }

    return curtain;
  }

  function onlyComponent(curtain: QuoteCurtain): QuoteFinancialItem {
    const [component] = curtain.components;

    if (component === undefined) {
      throw new Error('curtain has no component');
    }

    return component;
  }

  function eventOfType(
    entries: QuoteHistoryEntry[],
    eventType: string,
  ): QuoteHistoryEntry {
    const entry = entries.find(
      (candidate) => candidate.eventType === eventType,
    );

    if (entry === undefined) {
      throw new Error(`missing history event ${eventType}`);
    }

    return entry;
  }

  async function createCustomer(): Promise<string> {
    const response = await request(server())
      .post('/clientes')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({ name: `Cliente ${randomUUID()}`, phone: '(11) 99999-9999' })
      .expect(201);

    const id = response.body.id as string;
    customerIds.push(id);

    return id;
  }

  async function createQuote(
    customerId: string,
    body: Record<string, unknown> = {},
  ): Promise<QuoteDetail> {
    const response = await request(server())
      .post(`/clientes/${customerId}/orcamentos`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send(body)
      .expect(201);

    return response.body as QuoteDetail;
  }

  async function patchQuote(
    id: string,
    body: Record<string, unknown>,
  ): Promise<QuoteDetail> {
    const response = await request(server())
      .patch(`/orcamentos/${id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send(body)
      .expect(200);

    return response.body as QuoteDetail;
  }

  async function act(
    id: string,
    action: string,
    body: Record<string, unknown> = {},
  ): Promise<QuoteDetail> {
    const response = await request(server())
      .post(`/orcamentos/${id}/${action}`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send(body)
      .expect(200);

    return response.body as QuoteDetail;
  }

  function completeQuoteBody(): Record<string, unknown> {
    return {
      installationAddress: COMPLETE_ADDRESS,
      curtains: [
        {
          room: 'Sala',
          material: 'Linho',
          openingWidth: 2,
          borderValue: 0,
          height: 2.2,
          fabricFactor: 2,
          components: [
            { name: 'Tecido', quantity: 1, unit: 'm', unitPriceCents: 10_000 },
          ],
        },
      ],
    };
  }

  function errorCodes(response: request.Response): string[] {
    return ((response.body.errors ?? []) as { code: string }[]).map(
      (error) => error.code,
    );
  }

  it('runs the quote commercial lifecycle from draft to completion', async () => {
    const customerId = await createCustomer();

    const created = await createQuote(customerId);
    expect(created).toMatchObject({
      customerId,
      status: 'DRAFT',
      notes: null,
      commercialAdjustmentCents: null,
      installationAddress: null,
      curtains: [],
      generalAddOns: [],
      discount: {
        type: 'NO_DISCOUNT',
        percentage: null,
        fixedAmountCents: null,
      },
      totals: ZERO_TOTALS,
      firstSentAt: null,
      validUntil: null,
      confirmedAt: null,
      productionStartedAt: null,
      scheduledInstallationAt: null,
      completedAt: null,
      expired: false,
      lateInstallation: false,
    });
    expect(created.quoteNumber).toMatch(QUOTE_NUMBER);
    expect(created.createdAt).toMatch(ISO_DATE);
    expect(created.updatedAt).toMatch(ISO_DATE);

    const withAddress = await patchQuote(created.id, {
      notes: '  Instalação no apartamento  ',
      installationAddress: { ...COMPLETE_ADDRESS, state: 'sp' },
    });
    expect(withAddress.notes).toBe('Instalação no apartamento');
    expect(withAddress.installationAddress).toEqual({
      ...COMPLETE_ADDRESS,
      postalCode: '01310100',
    });

    const withCurtain = await patchQuote(created.id, {
      curtains: [
        {
          room: 'Sala',
          material: 'Linho',
          openingWidth: 2.5,
          borderValue: 0.1,
          height: 2.2,
          fabricFactor: 2.5,
        },
      ],
    });
    const curtain = onlyCurtain(withCurtain);
    expect(curtain).toMatchObject({
      sequence: 1,
      room: 'Sala',
      material: 'Linho',
      openingWidth: 2.5,
      borderValue: 0.1,
      finalWidth: 2.7,
      height: 2.2,
      fabricFactor: 2.5,
      fabricQuantity: 6.75,
      components: [],
      totalCents: 0,
    });
    expect(withCurtain.totals).toEqual(ZERO_TOTALS);

    const withComponent = await patchQuote(created.id, {
      curtains: [
        {
          id: curtain.id,
          components: [
            { name: 'Tecido', quantity: 2, unit: 'm', unitPriceCents: 10_000 },
          ],
        },
      ],
    });
    const component = onlyComponent(onlyCurtain(withComponent));
    expect(component).toMatchObject({
      name: 'Tecido',
      quantity: 2,
      unit: 'm',
      unitPriceCents: 10_000,
      totalCents: 20_000,
    });
    expect(withComponent.totals).toMatchObject({
      curtainsSubtotalCents: 20_000,
      generalAddOnsSubtotalCents: 0,
      subtotalCents: 20_000,
      discountValueCents: 0,
      calculatedTotalCents: 20_000,
      commercialAdjustmentCents: 0,
      totalCents: 20_000,
    });

    const withAddOn = await patchQuote(created.id, {
      generalAddOns: [
        { name: 'Instalação', quantity: 3, unit: 'h', unitPriceCents: 5_000 },
      ],
    });
    const addOn = withAddOn.generalAddOns[0];
    expect(addOn).toMatchObject({
      name: 'Instalação',
      quantity: 3,
      unitPriceCents: 5_000,
      totalCents: 15_000,
    });
    expect(withAddOn.totals).toMatchObject({
      curtainsSubtotalCents: 20_000,
      generalAddOnsSubtotalCents: 15_000,
      subtotalCents: 35_000,
      discountValueCents: 0,
      calculatedTotalCents: 35_000,
      totalCents: 35_000,
    });

    const withDiscount = await patchQuote(created.id, {
      discount: { type: 'PERCENTAGE', percentage: 10 },
      commercialAdjustmentCents: -500,
    });
    expect(withDiscount.discount).toEqual({
      type: 'PERCENTAGE',
      percentage: 10,
      fixedAmountCents: null,
    });
    expect(withDiscount.commercialAdjustmentCents).toBe(-500);
    expect(withDiscount.totals).toEqual({
      curtainsSubtotalCents: 20_000,
      generalAddOnsSubtotalCents: 15_000,
      subtotalCents: 35_000,
      discountValueCents: 3_500,
      calculatedTotalCents: 31_500,
      commercialAdjustmentCents: -500,
      totalCents: 31_000,
    });

    const validUntil = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const sent = await act(created.id, 'enviar', { validUntil });
    expect(sent.status).toBe('SENT');
    expect(sent.firstSentAt).toMatch(ISO_DATE);
    expect(sent.validUntil).toBe(validUntil);
    expect(sent.expired).toBe(false);
    expect(Date.parse(sent.validUntil ?? '')).toBeGreaterThan(
      Date.parse(sent.firstSentAt ?? ''),
    );

    const confirmed = await act(created.id, 'confirmar');
    expect(confirmed.status).toBe('CONFIRMED');
    expect(confirmed.confirmedAt).toMatch(ISO_DATE);
    expect(confirmed.validUntil).toBe(validUntil);

    const inProduction = await act(created.id, 'iniciar-producao');
    expect(inProduction.status).toBe('IN_PRODUCTION');
    expect(inProduction.productionStartedAt).toMatch(ISO_DATE);
    expect(inProduction.confirmedAt).toBe(confirmed.confirmedAt);

    // D102/D118: a quote in production can no longer be cancelled.
    await request(server())
      .post(`/orcamentos/${created.id}/cancelar`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({ reason: 'Cliente desistiu' })
      .expect(409);

    const installedAt = new Date(
      Date.now() - 24 * 60 * 60 * 1000,
    ).toISOString();
    const scheduled = await request(server())
      .put(`/orcamentos/${created.id}/instalacao`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({ scheduledInstallationAt: installedAt })
      .expect(200);
    const scheduledQuote = scheduled.body as QuoteDetail;
    expect(scheduledQuote.status).toBe('IN_PRODUCTION');
    expect(scheduledQuote.scheduledInstallationAt).toBe(installedAt);
    expect(scheduledQuote.lateInstallation).toBe(true);

    const completed = await act(created.id, 'concluir');
    expect(completed.status).toBe('COMPLETED');
    expect(completed.completedAt).toMatch(ISO_DATE);
    expect(completed.scheduledInstallationAt).toBe(installedAt);
    // D105: lateness only applies while the service is still pending.
    expect(completed.lateInstallation).toBe(false);

    const detail = await request(server())
      .get(`/orcamentos/${created.id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(detail.body).toEqual(completed);

    const history = await request(server())
      .get(`/orcamentos/${created.id}/historico`)
      .set('Cookie', cookie)
      .expect(200);
    const entries = history.body as QuoteHistoryEntry[];

    // Creation, five effective edits, and one event per business action.
    expect(eventTypes(entries)).toEqual(
      [
        'PRODUCTION_STARTED',
        'QUOTE_CONFIRMED',
        'QUOTE_CREATED',
        'QUOTE_EDITED',
        'QUOTE_EDITED',
        'QUOTE_EDITED',
        'QUOTE_EDITED',
        'QUOTE_EDITED',
        'QUOTE_SENT',
        'INSTALLATION_SCHEDULED',
        'SERVICE_COMPLETED',
      ].sort(),
    );
    for (const entry of entries) {
      expect(entry.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(entry.occurredAt).toMatch(ISO_DATE);
    }
    const occurredAt = entries.map((entry) => Date.parse(entry.occurredAt));
    expect(occurredAt).toEqual([...occurredAt].sort((a, b) => a - b));

    expect(eventOfType(entries, 'QUOTE_CREATED').details).toEqual({
      quoteNumber: created.quoteNumber,
    });
    expect(eventOfType(entries, 'QUOTE_SENT').details).toEqual({
      validUntil,
      firstSend: true,
    });
    expect(eventOfType(entries, 'INSTALLATION_SCHEDULED').details).toEqual({
      scheduledInstallationAt: installedAt,
    });

    const editedFields = entries
      .filter((entry) => entry.eventType === 'QUOTE_EDITED')
      .flatMap((entry) => entry.details?.changes ?? [])
      .map((change) => change.field);
    expect(editedFields).toEqual(
      expect.arrayContaining([
        'installationAddress.postalCode',
        'curtain',
        'component',
        'generalAddOn',
        'discountType',
        'discountPercentage',
        'commercialAdjustmentCents',
      ]),
    );

    const persisted = await prisma.quote.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(persisted.status).toBe('COMPLETED');
    expect(persisted.completedAt).not.toBeNull();
    expect(persisted.validUntil?.toISOString()).toBe(validUntil);
  }, 30_000);

  it('rejects quote requests without authentication', async () => {
    await request(server()).get('/orcamentos').expect(401);

    await request(server())
      .post(`/orcamentos/${randomUUID()}/confirmar`)
      .set('Origin', ORIGIN)
      .expect(401);
  });

  it('rejects sending an empty draft with validation violations', async () => {
    const customerId = await createCustomer();
    const quote = await createQuote(customerId);

    const response = await request(server())
      .post(`/orcamentos/${quote.id}/enviar`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({})
      .expect(422);

    expect(errorCodes(response)).toEqual(
      expect.arrayContaining([
        'INSTALLATION_ADDRESS_INCOMPLETE',
        'NO_CURTAINS',
      ]),
    );

    const persisted = await prisma.quote.findUniqueOrThrow({
      where: { id: quote.id },
    });
    expect(persisted.status).toBe('DRAFT');
  });

  it('rejects a creation whose derived total overflows the monetary range', async () => {
    const customerId = await createCustomer();

    const response = await request(server())
      .post(`/clientes/${customerId}/orcamentos`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({
        installationAddress: COMPLETE_ADDRESS,
        curtains: [
          {
            room: 'Sala',
            material: 'Linho',
            openingWidth: 2,
            borderValue: 0,
            height: 2.2,
            fabricFactor: 2,
            components: [
              {
                name: 'Tecido',
                quantity: 999_999,
                unit: 'm',
                unitPriceCents: 2_147_483_647,
              },
            ],
          },
        ],
      })
      .expect(422);

    expect(errorCodes(response)).toEqual(['TOTAL_OUT_OF_RANGE']);
    expect(await prisma.quote.count({ where: { customerId } })).toBe(0);
  });

  it('rejects sending a quote with an incomplete installation address', async () => {
    const customerId = await createCustomer();
    const quote = await createQuote(customerId, {
      ...completeQuoteBody(),
      installationAddress: {
        street: 'Rua das Flores',
        city: 'São Paulo',
        state: 'SP',
      },
    });

    const response = await request(server())
      .post(`/orcamentos/${quote.id}/enviar`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({})
      .expect(422);

    const codes = errorCodes(response);
    expect(codes).toContain('INSTALLATION_ADDRESS_INCOMPLETE');
    expect(codes).not.toContain('NO_CURTAINS');
  });

  it('rejects confirming a quote whose validity elapsed', async () => {
    const customerId = await createCustomer();
    const quote = await createQuote(customerId, completeQuoteBody());

    await act(quote.id, 'enviar', {
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Time travel: persistence is the only way to reach a SENT quote with an
    // elapsed validity, since the send gate requires a future one.
    await prisma.quote.update({
      where: { id: quote.id },
      data: { validUntil: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    await request(server())
      .post(`/orcamentos/${quote.id}/confirmar`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({})
      .expect(409);

    const persisted = await prisma.quote.findUniqueOrThrow({
      where: { id: quote.id },
    });
    expect(persisted.status).toBe('SENT');
    expect(persisted.confirmedAt).toBeNull();
  });

  it('rejects an invalid state transition with a conflict', async () => {
    const customerId = await createCustomer();
    const quote = await createQuote(customerId);

    await request(server())
      .post(`/orcamentos/${quote.id}/iniciar-producao`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({})
      .expect(409);

    await request(server())
      .post(`/orcamentos/${quote.id}/concluir`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({})
      .expect(409);

    const persisted = await prisma.quote.findUniqueOrThrow({
      where: { id: quote.id },
    });
    expect(persisted.status).toBe('DRAFT');
    expect(persisted.productionStartedAt).toBeNull();
    expect(persisted.completedAt).toBeNull();
  });

  it('rejects foreign child ids and leaves the target quote untouched', async () => {
    const customerId = await createCustomer();
    const foreign = await createQuote(customerId, completeQuoteBody());
    const target = await createQuote(customerId, completeQuoteBody());
    const foreignCurtain = onlyCurtain(foreign);
    const foreignComponent = onlyComponent(foreignCurtain);
    const targetCurtain = onlyCurtain(target);

    const foreignCurtainResponse = await request(server())
      .patch(`/orcamentos/${target.id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({ curtains: [{ id: foreignCurtain.id }] })
      .expect(422);
    expect(foreignCurtainResponse.body).toMatchObject({
      statusCode: 422,
      message: 'Unknown curtain id',
    });

    const foreignComponentResponse = await request(server())
      .patch(`/orcamentos/${target.id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({
        curtains: [
          { id: targetCurtain.id, components: [{ id: foreignComponent.id }] },
        ],
      })
      .expect(422);
    expect(foreignComponentResponse.body).toMatchObject({
      statusCode: 422,
      message: 'Unknown financial item id',
    });

    const unchanged = await request(server())
      .get(`/orcamentos/${target.id}`)
      .set('Cookie', cookie)
      .expect(200);
    const unchangedQuote = unchanged.body as QuoteDetail;
    expect(onlyCurtain(unchangedQuote).id).toBe(targetCurtain.id);
    expect(onlyComponent(onlyCurtain(unchangedQuote)).id).toBe(
      onlyComponent(targetCurtain).id,
    );
  });
});

function eventTypes(entries: QuoteHistoryEntry[]): string[] {
  return entries.map((entry) => entry.eventType).sort();
}
