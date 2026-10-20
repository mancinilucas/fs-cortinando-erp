import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { QuoteStatus } from '../src/generated/prisma/client.js';
import { Argon2PasswordHasher } from '../src/modules/auth/infrastructure/argon2-password-hasher.js';
import { sessionCookieName } from '../src/modules/auth/presentation/session-cookie.js';
import { Clock } from '../src/modules/orcamentos/application/ports/clock.port.js';
import { formatQuoteNumber } from '../src/modules/orcamentos/domain/value-objects/quote-number.js';
import { PrismaService } from '../src/shared/database/prisma.service.js';

// End-to-end coverage of GET /dashboard (DASHBOARD-10). The Application Clock
// is overridden so the civil week and every boundary are deterministic; the
// request still travels HTTP -> Application -> Prisma -> PostgreSQL.

const ORIGIN = 'http://localhost:5173';
const NOW = new Date('2041-03-06T12:00:00.000Z');
const WEEK_START = new Date('2041-03-04T03:00:00.000Z');
const WEEK_END = new Date('2041-03-11T03:00:00.000Z');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

interface DashboardInstallation {
  quoteId: string;
  quoteNumber: string;
  customerName: string;
  scheduledInstallationAt: string;
  status: string;
}

interface DashboardBody {
  statusCounts: {
    draft: number;
    sent: number;
    expired: number;
    confirmed: number;
    inProduction: number;
  };
  upcomingInstallations: DashboardInstallation[];
  weeklyInstallations: DashboardInstallation[];
  overdueInstallations: DashboardInstallation[];
}

interface SeededCustomer {
  id: string;
  name: string;
  phone: string;
  email: string;
  taxId: string;
  notes: string;
}

interface SeededQuote {
  id: string;
  quoteNumber: string;
  scheduledInstallationAt: Date | null;
}

describe('Dashboard (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookie: string;
  let userId: string | null = null;
  let originalAppOrigin: string | undefined;
  let customerIds: string[];
  let quoteCounter = 0;

  const year = randomInt(3_500, 3_599);
  const token = randomUUID();
  const email = `e2e-dashboard-${randomUUID()}@example.com`;
  const password = `pw-${randomUUID()}`;

  beforeAll(async () => {
    originalAppOrigin = process.env.APP_ORIGIN;
    process.env.APP_ORIGIN = ORIGIN;

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(Clock)
      .useValue({ now: () => new Date(NOW) })
      .compile();

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

  afterEach(async () => {
    if (customerIds.length > 0) {
      // Quote -> Customer is Restrict; quote children and history cascade.
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

  beforeEach(() => {
    customerIds = [];
    quoteCounter = 0;
  });

  function server() {
    return app.getHttpServer();
  }

  async function createCustomer(
    suffix: string,
    options: { deleted?: boolean } = {},
  ): Promise<SeededCustomer> {
    const id = randomUUID();
    const name = `Dashboard ${token} ${suffix}`;
    const phone = `119${String(randomInt(10_000_000, 99_999_999))}`;
    const customer = {
      id,
      name,
      phone,
      email: `${suffix}-${token}@example.com`,
      taxId: `tax-${token}-${suffix}`,
      notes: `private-notes-${token}`,
    };

    await prisma.customer.create({
      data: {
        ...customer,
        addressPostalCode: '01310100',
        addressStreet: 'Avenida Paulista',
        addressNumber: '1000',
        addressCity: 'São Paulo',
        addressState: 'SP',
        deletedAt: options.deleted
          ? new Date('2026-01-01T00:00:00.000Z')
          : null,
      },
    });
    customerIds.push(id);

    return customer;
  }

  async function createQuote(input: {
    customer: SeededCustomer;
    status: QuoteStatus;
    validUntil?: Date | null;
    scheduledInstallationAt?: Date | null;
  }): Promise<SeededQuote> {
    quoteCounter += 1;
    const id = randomUUID();
    const quoteNumber = formatQuoteNumber(year, quoteCounter);
    const scheduledInstallationAt = input.scheduledInstallationAt ?? null;

    await prisma.quote.create({
      data: {
        id,
        quoteNumber,
        customerId: input.customer.id,
        status: input.status,
        validUntil: input.validUntil ?? null,
        scheduledInstallationAt,
      },
    });

    return { id, quoteNumber, scheduledInstallationAt };
  }

  function scheduledIso(quote: SeededQuote): string {
    if (quote.scheduledInstallationAt === null) {
      throw new Error('seeded quote has no installation date');
    }

    return quote.scheduledInstallationAt.toISOString();
  }

  function installation(
    quote: SeededQuote,
    customer: SeededCustomer,
    status: QuoteStatus,
  ): DashboardInstallation {
    return {
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      customerName: customer.name,
      scheduledInstallationAt: scheduledIso(quote),
      status,
    };
  }

  it('rejects a request without a session', async () => {
    await request(server()).get('/dashboard').expect(401);
  });

  it('returns zero counters and empty lists without eligible quotes', async () => {
    const response = await request(server())
      .get('/dashboard')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body).toEqual({
      statusCounts: {
        draft: 0,
        sent: 0,
        expired: 0,
        confirmed: 0,
        inProduction: 0,
      },
      upcomingInstallations: [],
      weeklyInstallations: [],
      overdueInstallations: [],
    });
  });

  it('materializes the full contract from PostgreSQL', async () => {
    const active = await createCustomer('active');
    const deleted = await createCustomer('deleted', { deleted: true });

    await createQuote({
      customer: active,
      status: QuoteStatus.DRAFT,
    });
    await createQuote({
      customer: active,
      status: QuoteStatus.SENT,
      validUntil: null,
    });
    await createQuote({
      customer: active,
      status: QuoteStatus.SENT,
      validUntil: new Date(NOW.getTime() + DAY),
    });
    await createQuote({
      customer: active,
      status: QuoteStatus.SENT,
      validUntil: NOW,
    });
    await createQuote({
      customer: active,
      status: QuoteStatus.SENT,
      validUntil: new Date(NOW.getTime() - 1),
    });
    await createQuote({
      customer: active,
      status: QuoteStatus.CONFIRMED,
    });
    await createQuote({
      customer: active,
      status: QuoteStatus.IN_PRODUCTION,
    });
    const completed = await createQuote({
      customer: active,
      status: QuoteStatus.COMPLETED,
      scheduledInstallationAt: new Date(NOW.getTime() - 2 * HOUR),
    });
    const cancelled = await createQuote({
      customer: active,
      status: QuoteStatus.CANCELLED,
      scheduledInstallationAt: new Date(WEEK_START.getTime() + HOUR),
    });

    const upcomingAtNow = await createQuote({
      customer: deleted,
      status: QuoteStatus.CONFIRMED,
      scheduledInstallationAt: NOW,
    });
    const tieA = await createQuote({
      customer: active,
      status: QuoteStatus.CONFIRMED,
      scheduledInstallationAt: new Date(NOW.getTime() + HOUR),
    });
    const tieB = await createQuote({
      customer: active,
      status: QuoteStatus.IN_PRODUCTION,
      scheduledInstallationAt: new Date(NOW.getTime() + HOUR),
    });
    await createQuote({
      customer: active,
      status: QuoteStatus.CONFIRMED,
      scheduledInstallationAt: new Date(WEEK_END.getTime() + HOUR),
    });
    await createQuote({
      customer: active,
      status: QuoteStatus.CONFIRMED,
      scheduledInstallationAt: new Date(WEEK_END.getTime() + 2 * HOUR),
    });
    await createQuote({
      customer: active,
      status: QuoteStatus.CONFIRMED,
      scheduledInstallationAt: new Date(WEEK_END.getTime() + 3 * HOUR),
    });

    const weekBefore = await createQuote({
      customer: active,
      status: QuoteStatus.CONFIRMED,
      scheduledInstallationAt: new Date(WEEK_START.getTime() - 1),
    });
    const weekAtStart = await createQuote({
      customer: active,
      status: QuoteStatus.IN_PRODUCTION,
      scheduledInstallationAt: WEEK_START,
    });
    const weekInside = await createQuote({
      customer: active,
      status: QuoteStatus.CONFIRMED,
      scheduledInstallationAt: new Date(WEEK_START.getTime() + DAY),
    });
    const weekBeforeEnd = await createQuote({
      customer: active,
      status: QuoteStatus.CONFIRMED,
      scheduledInstallationAt: new Date(WEEK_END.getTime() - 1),
    });
    const weekAtEnd = await createQuote({
      customer: active,
      status: QuoteStatus.CONFIRMED,
      scheduledInstallationAt: WEEK_END,
    });
    await createQuote({
      customer: active,
      status: QuoteStatus.COMPLETED,
      scheduledInstallationAt: new Date(WEEK_START.getTime() + HOUR),
    });
    await createQuote({
      customer: active,
      status: QuoteStatus.CANCELLED,
      scheduledInstallationAt: new Date(WEEK_START.getTime() + 2 * HOUR),
    });

    const overdueOlder = await createQuote({
      customer: active,
      status: QuoteStatus.CONFIRMED,
      scheduledInstallationAt: new Date(NOW.getTime() - 2 * HOUR),
    });
    const overdueNewer = await createQuote({
      customer: active,
      status: QuoteStatus.IN_PRODUCTION,
      scheduledInstallationAt: new Date(NOW.getTime() - HOUR),
    });

    const response = await request(server())
      .get('/dashboard')
      .set('Cookie', cookie)
      .expect(200);
    const body = response.body as DashboardBody;

    expect(body).toEqual({
      statusCounts: {
        draft: 1,
        sent: 3,
        expired: 1,
        confirmed: 11,
        inProduction: 4,
      },
      upcomingInstallations: [
        installation(upcomingAtNow, deleted, QuoteStatus.CONFIRMED),
        installation(tieA, active, QuoteStatus.CONFIRMED),
        installation(tieB, active, QuoteStatus.IN_PRODUCTION),
        installation(weekBeforeEnd, active, QuoteStatus.CONFIRMED),
        installation(weekAtEnd, active, QuoteStatus.CONFIRMED),
      ],
      weeklyInstallations: [
        installation(weekAtStart, active, QuoteStatus.IN_PRODUCTION),
        installation(weekInside, active, QuoteStatus.CONFIRMED),
        installation(overdueOlder, active, QuoteStatus.CONFIRMED),
        installation(overdueNewer, active, QuoteStatus.IN_PRODUCTION),
        installation(upcomingAtNow, deleted, QuoteStatus.CONFIRMED),
        installation(tieA, active, QuoteStatus.CONFIRMED),
        installation(tieB, active, QuoteStatus.IN_PRODUCTION),
        installation(weekBeforeEnd, active, QuoteStatus.CONFIRMED),
      ],
      overdueInstallations: [
        installation(weekBefore, active, QuoteStatus.CONFIRMED),
        installation(weekAtStart, active, QuoteStatus.IN_PRODUCTION),
        installation(weekInside, active, QuoteStatus.CONFIRMED),
        installation(overdueOlder, active, QuoteStatus.CONFIRMED),
        installation(overdueNewer, active, QuoteStatus.IN_PRODUCTION),
      ],
    });

    // Closed contract: counters and items expose exactly the approved keys.
    expect(Object.keys(body).sort()).toEqual([
      'overdueInstallations',
      'statusCounts',
      'upcomingInstallations',
      'weeklyInstallations',
    ]);
    expect(Object.keys(body.statusCounts).sort()).toEqual([
      'confirmed',
      'draft',
      'expired',
      'inProduction',
      'sent',
    ]);
    expect(body.statusCounts).not.toHaveProperty('completed');
    expect(body.statusCounts).not.toHaveProperty('cancelled');

    for (const list of [
      body.upcomingInstallations,
      body.weeklyInstallations,
      body.overdueInstallations,
    ]) {
      for (const item of list) {
        expect(Object.keys(item).sort()).toEqual([
          'customerName',
          'quoteId',
          'quoteNumber',
          'scheduledInstallationAt',
          'status',
        ]);
        expect(item).not.toHaveProperty('phone');
      }
    }

    const serialized = JSON.stringify(body);

    for (const secret of [
      active.phone,
      active.email,
      active.taxId,
      active.notes,
      deleted.phone,
      deleted.email,
      deleted.taxId,
      deleted.notes,
      'Avenida Paulista',
      'totals',
      'curtains',
    ]) {
      expect(serialized).not.toContain(secret);
    }

    // COMPLETED/CANCELLED never enter the installation cards.
    const installationIds = [
      ...body.upcomingInstallations,
      ...body.weeklyInstallations,
      ...body.overdueInstallations,
    ].map((item) => item.quoteId);

    expect(installationIds).not.toContain(completed.id);
    expect(installationIds).not.toContain(cancelled.id);
  });
});
