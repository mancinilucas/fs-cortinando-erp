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

// End-to-end coverage of the quote flows most prone to state inconsistency
// (ORCAMENTO-44): partial PATCH semantics and child reconciliation, reopening,
// renewal while valid and after expiry, cancellation at every allowed status
// and physical draft deletion without reusing the quote number.

const ORIGIN = 'http://localhost:5173';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
    previousConfirmedAt?: string | null;
    previousScheduledInstallationAt?: string | null;
    previousValidUntil?: string;
    newValidUntil?: string;
    scheduledInstallationAt?: string;
    reason?: string;
    changes?: { field: string }[];
  } | null;
}

describe('Quotes alternate lifecycle (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookie: string;
  let userId: string | null = null;
  let originalAppOrigin: string | undefined;
  let customerIds: string[];

  const email = `e2e-orcamentos-lifecycle-${randomUUID()}@example.com`;
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

  function onlyCurtain(quote: QuoteDetail, index: number): QuoteCurtain {
    const curtain = quote.curtains[index];

    if (curtain === undefined) {
      throw new Error(`quote has no curtain at index ${index}`);
    }

    return curtain;
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

  async function getQuote(id: string): Promise<QuoteDetail> {
    const response = await request(server())
      .get(`/orcamentos/${id}`)
      .set('Cookie', cookie)
      .expect(200);

    return response.body as QuoteDetail;
  }

  async function history(id: string): Promise<QuoteHistoryEntry[]> {
    const response = await request(server())
      .get(`/orcamentos/${id}/historico`)
      .set('Cookie', cookie)
      .expect(200);

    return response.body as QuoteHistoryEntry[];
  }

  function futureIso(offsetDays: number): string {
    return new Date(
      Date.now() + offsetDays * 24 * 60 * 60 * 1000,
    ).toISOString();
  }

  function editableBody(): Record<string, unknown> {
    return {
      notes: 'Inicial',
      installationAddress: COMPLETE_ADDRESS,
      discount: { type: 'PERCENTAGE', percentage: 10 },
      commercialAdjustmentCents: 1_000,
      curtains: [
        {
          room: 'Sala',
          material: 'Linho',
          openingWidth: 2,
          borderValue: 0,
          height: 2.2,
          fabricFactor: 2,
          components: [
            { name: 'Tecido', quantity: 2, unit: 'm', unitPriceCents: 10_000 },
            { name: 'Forro', quantity: 1, unit: 'm', unitPriceCents: 5_000 },
          ],
        },
        {
          room: 'Quarto',
          material: 'Voal',
          openingWidth: 1.5,
          borderValue: 0,
          height: 2,
          fabricFactor: 2,
          components: [
            { name: 'Tecido', quantity: 1, unit: 'm', unitPriceCents: 10_000 },
          ],
        },
      ],
      generalAddOns: [
        { name: 'Frete', quantity: 1, unit: 'un', unitPriceCents: 5_000 },
      ],
    };
  }

  async function createEditableQuote(): Promise<QuoteDetail> {
    return createQuote(await createCustomer(), editableBody());
  }

  it('applies a truly partial PATCH without touching omitted data', async () => {
    const initial = await createEditableQuote();
    expect(initial.totals).toEqual({
      curtainsSubtotalCents: 35_000,
      generalAddOnsSubtotalCents: 5_000,
      subtotalCents: 40_000,
      discountValueCents: 4_000,
      calculatedTotalCents: 36_000,
      commercialAdjustmentCents: 1_000,
      totalCents: 37_000,
    });

    const notesOnly = await patchQuote(initial.id, { notes: '  Revisado  ' });
    expect(notesOnly.notes).toBe('Revisado');
    expect(notesOnly.installationAddress).toEqual(initial.installationAddress);
    expect(notesOnly.discount).toEqual(initial.discount);
    expect(notesOnly.commercialAdjustmentCents).toBe(1_000);
    expect(notesOnly.curtains).toEqual(initial.curtains);
    expect(notesOnly.generalAddOns).toEqual(initial.generalAddOns);
    expect(notesOnly.totals).toEqual(initial.totals);

    const cleared = await patchQuote(initial.id, {
      notes: null,
      commercialAdjustmentCents: null,
    });
    expect(cleared.notes).toBeNull();
    expect(cleared.commercialAdjustmentCents).toBeNull();
    expect(cleared.discount).toEqual(initial.discount);
    expect(cleared.curtains).toEqual(initial.curtains);
    expect(cleared.generalAddOns).toEqual(initial.generalAddOns);
    expect(cleared.totals).toEqual({
      ...initial.totals,
      commercialAdjustmentCents: 0,
      totalCents: 36_000,
    });

    const entries = await history(initial.id);
    const edited = entries.filter(
      (entry) => entry.eventType === 'QUOTE_EDITED',
    );
    expect(edited).toHaveLength(2);
    const fields = edited.flatMap((entry) =>
      (entry.details?.changes ?? []).map((change) => change.field),
    );
    expect(fields).toEqual(
      expect.arrayContaining(['notes', 'commercialAdjustmentCents']),
    );
  });

  it('reconciles sent collections by id and removes omitted children', async () => {
    const initial = await createEditableQuote();
    const sala = onlyCurtain(initial, 0);
    const quarto = onlyCurtain(initial, 1);
    const [tecido, forro] = sala.components;
    const frete = initial.generalAddOns[0];

    if (!tecido || !forro || !frete) {
      throw new Error('fixture is incomplete');
    }

    const reconciled = await patchQuote(initial.id, {
      curtains: [
        {
          id: sala.id,
          room: 'Sala de Estar',
          components: [
            { id: tecido.id, quantity: 3 },
            { name: 'Ilhós', quantity: 1, unit: 'm', unitPriceCents: 2_000 },
          ],
        },
        {
          room: 'Cozinha',
          material: 'Linho',
          openingWidth: 1,
          borderValue: 0.05,
          height: 1.5,
          fabricFactor: 2,
          components: [
            { name: 'Tecido', quantity: 1, unit: 'm', unitPriceCents: 4_000 },
          ],
        },
      ],
    });

    expect(reconciled.curtains).toHaveLength(2);

    const reconciledSala = onlyCurtain(reconciled, 0);
    expect(reconciledSala).toMatchObject({
      id: sala.id,
      sequence: 1,
      room: 'Sala de Estar',
      material: 'Linho',
      openingWidth: 2,
      borderValue: 0,
      height: 2.2,
      fabricFactor: 2,
      totalCents: 32_000,
    });
    expect(reconciledSala.components).toHaveLength(2);
    expect(reconciledSala.components[0]).toMatchObject({
      id: tecido.id,
      name: 'Tecido',
      quantity: 3,
      unit: 'm',
      unitPriceCents: 10_000,
      totalCents: 30_000,
    });
    expect(reconciledSala.components[1]).toMatchObject({
      name: 'Ilhós',
      quantity: 1,
      unit: 'm',
      unitPriceCents: 2_000,
      totalCents: 2_000,
    });
    const ilhos = reconciledSala.components[1];
    expect(ilhos?.id).toMatch(UUID);

    const reconciledCozinha = onlyCurtain(reconciled, 1);
    expect(reconciledCozinha.id).toMatch(UUID);
    expect(reconciledCozinha.id).not.toBe(quarto.id);
    expect(reconciledCozinha).toMatchObject({
      sequence: 2,
      room: 'Cozinha',
      material: 'Linho',
      openingWidth: 1,
      borderValue: 0.05,
      finalWidth: 1.1,
      height: 1.5,
      fabricFactor: 2,
      fabricQuantity: 2.2,
      totalCents: 4_000,
    });

    // Curtain and component totals are recomputed from the reconciled state;
    // discount and adjustment were not part of the patch and stay unchanged.
    expect(reconciled.totals).toEqual({
      curtainsSubtotalCents: 36_000,
      generalAddOnsSubtotalCents: 5_000,
      subtotalCents: 41_000,
      discountValueCents: 4_100,
      calculatedTotalCents: 36_900,
      commercialAdjustmentCents: 1_000,
      totalCents: 37_900,
    });

    const withAddOns = await patchQuote(initial.id, {
      generalAddOns: [
        { id: frete.id, quantity: 2 },
        { name: 'Montagem', quantity: 1, unit: 'un', unitPriceCents: 3_000 },
      ],
    });
    expect(withAddOns.generalAddOns).toHaveLength(2);
    expect(withAddOns.generalAddOns[0]).toMatchObject({
      id: frete.id,
      name: 'Frete',
      quantity: 2,
      unitPriceCents: 5_000,
      totalCents: 10_000,
    });
    expect(withAddOns.generalAddOns[1]).toMatchObject({
      name: 'Montagem',
      quantity: 1,
      unit: 'un',
      unitPriceCents: 3_000,
      totalCents: 3_000,
    });
    expect(withAddOns.generalAddOns[1]?.id).toMatch(UUID);
    expect(withAddOns.totals).toEqual({
      curtainsSubtotalCents: 36_000,
      generalAddOnsSubtotalCents: 13_000,
      subtotalCents: 49_000,
      discountValueCents: 4_900,
      calculatedTotalCents: 44_100,
      commercialAdjustmentCents: 1_000,
      totalCents: 45_100,
    });

    // Removed children are physically gone; kept children preserve their ids.
    await expect(
      prisma.curtain.findUnique({ where: { id: quarto.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.financialComponent.findUnique({ where: { id: forro.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.financialComponent.findUnique({ where: { id: tecido.id } }),
    ).resolves.not.toBeNull();
    await expect(
      prisma.curtain.count({ where: { quoteId: initial.id } }),
    ).resolves.toBe(2);
    await expect(
      prisma.financialComponent.count({
        where: { curtainId: reconciledSala.id },
      }),
    ).resolves.toBe(2);
    await expect(
      prisma.generalAddOn.count({ where: { quoteId: initial.id } }),
    ).resolves.toBe(2);

    expect(await getQuote(initial.id)).toEqual(withAddOns);

    const edited = (await history(initial.id)).filter(
      (entry) => entry.eventType === 'QUOTE_EDITED',
    );
    expect(edited).toHaveLength(2);
    const fields = edited.flatMap((entry) =>
      (entry.details?.changes ?? []).map((change) => change.field),
    );
    expect(fields).toEqual(
      expect.arrayContaining(['curtain', 'component', 'generalAddOn']),
    );
  });

  it('rejects a SENT edit that would break the sending requirements', async () => {
    const draft = await createEditableQuote();
    const sent = await act(draft.id, 'enviar', { validUntil: futureIso(10) });

    const invalidPatches = [
      { installationAddress: null, code: 'INSTALLATION_ADDRESS_INCOMPLETE' },
      { curtains: [], code: 'NO_CURTAINS' },
    ];

    for (const { code, ...patch } of invalidPatches) {
      const response = await request(server())
        .patch(`/orcamentos/${draft.id}`)
        .set('Origin', ORIGIN)
        .set('Cookie', cookie)
        .send(patch)
        .expect(422);

      expect(response.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ code })]),
      );
    }

    // Rejected edits never reach persistence or history.
    expect(await getQuote(draft.id)).toEqual(sent);
    expect(
      (await history(draft.id)).filter(
        (entry) => entry.eventType === 'QUOTE_EDITED',
      ),
    ).toHaveLength(0);
  });

  it('reopens a confirmed quote clearing confirmation and installation', async () => {
    const draft = await createEditableQuote();
    const validUntil = futureIso(10);
    const sent = await act(draft.id, 'enviar', { validUntil });
    const confirmed = await act(draft.id, 'confirmar');
    const installationAt = futureIso(7);
    const scheduled = await request(server())
      .put(`/orcamentos/${draft.id}/instalacao`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({ scheduledInstallationAt: installationAt })
      .expect(200);
    expect((scheduled.body as QuoteDetail).scheduledInstallationAt).toBe(
      installationAt,
    );

    const reopened = await act(draft.id, 'reabrir');
    expect(reopened.status).toBe('SENT');
    expect(reopened.confirmedAt).toBeNull();
    expect(reopened.scheduledInstallationAt).toBeNull();
    expect(reopened.validUntil).toBe(validUntil);
    expect(reopened.firstSentAt).toBe(sent.firstSentAt);
    expect(reopened.productionStartedAt).toBeNull();

    const persisted = await getQuote(draft.id);
    expect(persisted).toEqual(reopened);

    const entry = eventOfType(await history(draft.id), 'QUOTE_REOPENED');
    expect(entry.details).toEqual({
      previousConfirmedAt: confirmed.confirmedAt,
      previousScheduledInstallationAt: installationAt,
    });
    expect(entry.occurredAt).toMatch(ISO_DATE);

    // Reopening keeps the quote usable while its validity has not elapsed.
    const reconfirmed = await act(draft.id, 'confirmar');
    expect(reconfirmed.status).toBe('CONFIRMED');
    expect(reconfirmed.validUntil).toBe(validUntil);
  });

  it('renews an expired quote and clears the expired derivation', async () => {
    const draft = await createEditableQuote();
    const sent = await act(draft.id, 'enviar', { validUntil: futureIso(10) });
    const elapsed = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await prisma.quote.update({
      where: { id: draft.id },
      data: { validUntil: elapsed },
    });
    const expired = await getQuote(draft.id);
    expect(expired.status).toBe('SENT');
    expect(expired.expired).toBe(true);

    const renewedUntil = futureIso(60);
    const renewed = await act(draft.id, 'renovar', {
      validUntil: renewedUntil,
    });
    expect(renewed.status).toBe('SENT');
    expect(renewed.validUntil).toBe(renewedUntil);
    expect(renewed.expired).toBe(false);
    expect(renewed.firstSentAt).toBe(sent.firstSentAt);

    const entry = eventOfType(await history(draft.id), 'QUOTE_RENEWED');
    expect(entry.details).toEqual({
      previousValidUntil: elapsed.toISOString(),
      newValidUntil: renewedUntil,
    });

    const rejected = await request(server())
      .post(`/orcamentos/${draft.id}/renovar`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({ validUntil: elapsed.toISOString() })
      .expect(422);
    expect(rejected.body.errors).toEqual([
      {
        code: 'VALID_UNTIL_NOT_FUTURE',
        message: 'Quote valid until must be strictly in the future',
      },
    ]);
  });

  it('renews a quote that is still valid', async () => {
    const draft = await createEditableQuote();
    const firstValidity = futureIso(10);
    const sent = await act(draft.id, 'enviar', {
      validUntil: firstValidity,
    });

    const secondValidity = futureIso(20);
    const renewed = await act(draft.id, 'renovar', {
      validUntil: secondValidity,
    });
    expect(renewed.status).toBe('SENT');
    expect(renewed.validUntil).toBe(secondValidity);
    expect(renewed.firstSentAt).toBe(sent.firstSentAt);
    expect(renewed.expired).toBe(false);

    const entry = eventOfType(await history(draft.id), 'QUOTE_RENEWED');
    expect(entry.details).toEqual({
      previousValidUntil: firstValidity,
      newValidUntil: secondValidity,
    });
  });

  it('cancels a draft with a normalized reason and blocks later sends', async () => {
    const customerId = await createCustomer();
    const quote = await createQuote(customerId);

    const cancelled = await act(quote.id, 'cancelar', {
      reason: '  Desistência do cliente  ',
    });
    expect(cancelled.status).toBe('CANCELLED');

    const entry = eventOfType(await history(quote.id), 'QUOTE_CANCELLED');
    expect(entry.details).toEqual({ reason: 'Desistência do cliente' });

    await request(server())
      .post(`/orcamentos/${quote.id}/enviar`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({})
      .expect(409);

    await request(server())
      .post(`/orcamentos/${quote.id}/cancelar`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({})
      .expect(409);

    expect((await getQuote(quote.id)).status).toBe('CANCELLED');
  });

  it('cancels a sent quote without a reason', async () => {
    const draft = await createEditableQuote();
    await act(draft.id, 'enviar', { validUntil: futureIso(10) });

    const cancelled = await act(draft.id, 'cancelar');
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.confirmedAt).toBeNull();

    const entry = eventOfType(await history(draft.id), 'QUOTE_CANCELLED');
    expect(entry.details).toEqual({});
  });

  it('cancels a confirmed quote preserving its confirmation date', async () => {
    const draft = await createEditableQuote();
    await act(draft.id, 'enviar', { validUntil: futureIso(10) });
    const confirmed = await act(draft.id, 'confirmar');

    const cancelled = await act(draft.id, 'cancelar', {
      reason: 'Mudança de planos',
    });
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.confirmedAt).toBe(confirmed.confirmedAt);
    expect(cancelled.productionStartedAt).toBeNull();
  });

  it('blocks cancellation after production starts', async () => {
    const draft = await createEditableQuote();
    await act(draft.id, 'enviar', { validUntil: futureIso(10) });
    await act(draft.id, 'confirmar');
    const inProduction = await act(draft.id, 'iniciar-producao');

    await request(server())
      .post(`/orcamentos/${draft.id}/cancelar`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({ reason: 'Tarde demais' })
      .expect(409);

    const persisted = await getQuote(draft.id);
    expect(persisted.status).toBe('IN_PRODUCTION');
    expect(persisted.productionStartedAt).toBe(
      inProduction.productionStartedAt,
    );
  });

  it('deletes a draft physically without reusing its number', async () => {
    const customerId = await createCustomer();
    const draft = await createQuote(customerId, editableBody());
    const removedCurtain = onlyCurtain(draft, 0);
    const removedComponent = removedCurtain.components[0];

    if (!removedComponent) {
      throw new Error('fixture is incomplete');
    }

    await request(server())
      .delete(`/orcamentos/${draft.id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .expect(204);

    await request(server())
      .get(`/orcamentos/${draft.id}`)
      .set('Cookie', cookie)
      .expect(404);
    await request(server())
      .get(`/orcamentos/${draft.id}/historico`)
      .set('Cookie', cookie)
      .expect(404);

    await expect(
      prisma.quote.findUnique({ where: { id: draft.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.curtain.count({ where: { quoteId: draft.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.financialComponent.count({ where: { id: removedComponent.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.generalAddOn.count({ where: { quoteId: draft.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.quoteHistory.count({ where: { quoteId: draft.id } }),
    ).resolves.toBe(0);

    const next = await createQuote(customerId);
    expect(sequenceOf(next.quoteNumber)).toBeGreaterThan(
      sequenceOf(draft.quoteNumber),
    );
    expect(next.quoteNumber).not.toBe(draft.quoteNumber);

    // Deletion is restricted to drafts.
    const sent = await createEditableQuote();
    await act(sent.id, 'enviar', { validUntil: futureIso(10) });
    await request(server())
      .delete(`/orcamentos/${sent.id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .expect(409);
    await expect(
      prisma.quote.findUnique({ where: { id: sent.id } }),
    ).resolves.not.toBeNull();
  });
});

function sequenceOf(quoteNumber: string): number {
  return Number(quoteNumber.split('-')[2]);
}
