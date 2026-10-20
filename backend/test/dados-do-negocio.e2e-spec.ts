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

const ORIGIN = 'http://localhost:5173';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('Dados do Negocio (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookie: string;
  let userId: string | null = null;
  let originalAppOrigin: string | undefined;

  const email = `e2e-dados-negocio-${randomUUID()}@example.com`;
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
  });

  beforeEach(async () => {
    await prisma.businessData.deleteMany();
  });

  afterAll(async () => {
    await prisma.businessData.deleteMany();
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

  it('rejects unauthenticated access to both routes', async () => {
    await request(server()).get('/dados-do-negocio').expect(401);
    await request(server())
      .put('/dados-do-negocio')
      .set('Origin', ORIGIN)
      .send({ commercialNameOrConsultant: 'Cortinando', phone: '11999999999' })
      .expect(401);
  });

  it('returns 404 while the business data is not configured', async () => {
    const response = await request(server())
      .get('/dados-do-negocio')
      .set('Cookie', cookie)
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      message: 'Business data is not configured',
    });
  });

  it('rejects a PUT without a valid origin', async () => {
    await request(server())
      .put('/dados-do-negocio')
      .set('Cookie', cookie)
      .send({ commercialNameOrConsultant: 'Cortinando', phone: '11999999999' })
      .expect(403);
  });

  it('creates with PUT and returns the resource with 200', async () => {
    const response = await request(server())
      .put('/dados-do-negocio')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({
        commercialNameOrConsultant: '  Cortinando  ',
        phone: '  (11) 99999-9999  ',
        email: '  Contato@Example.COM ',
        taxId: '123.456.789-01',
      })
      .expect(200);

    expect(response.body).toEqual({
      commercialNameOrConsultant: 'Cortinando',
      phone: '(11) 99999-9999',
      email: 'contato@example.com',
      taxId: '12345678901',
      updatedAt: expect.stringMatching(ISO_DATE),
    });
    expect(response.body).not.toHaveProperty('id');

    const rows = await prisma.businessData.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'business',
      commercialNameOrConsultant: 'Cortinando',
    });
  });

  it('reads the configured business data with GET', async () => {
    const created = await request(server())
      .put('/dados-do-negocio')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({
        commercialNameOrConsultant: 'Cortinando',
        phone: '11999999999',
        email: 'contato@example.com',
        taxId: '12345678901',
      })
      .expect(200);

    const read = await request(server())
      .get('/dados-do-negocio')
      .set('Cookie', cookie)
      .expect(200);

    expect(read.body).toEqual(created.body);
    expect(read.body).not.toHaveProperty('id');
    expect(read.body).not.toHaveProperty('createdAt');
  });

  it('updates with PUT without creating another row', async () => {
    await request(server())
      .put('/dados-do-negocio')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({
        commercialNameOrConsultant: 'Cortinando',
        phone: '11999999999',
        email: 'contato@example.com',
        taxId: '12345678901',
      })
      .expect(200);

    const updated = await request(server())
      .put('/dados-do-negocio')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({
        commercialNameOrConsultant: 'Cortinando Consultoria',
        phone: '11888887777',
      })
      .expect(200);

    expect(updated.body).toMatchObject({
      commercialNameOrConsultant: 'Cortinando Consultoria',
      phone: '11888887777',
      email: null,
      taxId: null,
    });
    await expect(prisma.businessData.count()).resolves.toBe(1);
  });

  it('discards id, updatedAt and unknown fields', async () => {
    const response = await request(server())
      .put('/dados-do-negocio')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({
        commercialNameOrConsultant: 'Cortinando',
        phone: '11999999999',
        id: 'other',
        updatedAt: '2026-10-20T12:00:00.000Z',
        unknown: 'value',
      })
      .expect(200);

    expect(response.body).not.toHaveProperty('id');
    expect(response.body).not.toHaveProperty('unknown');

    const row = await prisma.businessData.findFirst();
    expect(row).toMatchObject({ id: 'business' });
    await expect(prisma.businessData.count()).resolves.toBe(1);
  });

  it.each([
    ['a missing required field', { commercialNameOrConsultant: 'Cortinando' }],
    [
      'a blank required field',
      { commercialNameOrConsultant: '   ', phone: '11999999999' },
    ],
    [
      'an invalid email',
      {
        commercialNameOrConsultant: 'Cortinando',
        phone: '11999999999',
        email: 'not-an-email',
      },
    ],
    [
      'an invalid tax id',
      {
        commercialNameOrConsultant: 'Cortinando',
        phone: '11999999999',
        taxId: '1234567890',
      },
    ],
  ])('rejects %s with 400 and persists nothing', async (_case, body) => {
    const response = await request(server())
      .put('/dados-do-negocio')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send(body)
      .expect(400);

    expect(response.body).toMatchObject({ statusCode: 400 });
    await expect(prisma.businessData.count()).resolves.toBe(0);
  });
});
