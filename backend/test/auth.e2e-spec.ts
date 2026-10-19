import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { SessionTokenService } from '../src/modules/auth/application/session-token.service.js';
import { Argon2PasswordHasher } from '../src/modules/auth/infrastructure/argon2-password-hasher.js';
import { sessionCookieName } from '../src/modules/auth/presentation/session-cookie.js';
import { PrismaService } from '../src/shared/database/prisma.service.js';

const ORIGIN = 'http://localhost:5173';

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string | null = null;

  const email = `e2e-${randomUUID()}@example.com`;
  const password = `pw-${randomUUID()}`;
  let originalAppOrigin: string | undefined;

  beforeAll(async () => {
    originalAppOrigin = process.env.APP_ORIGIN;
    process.env.APP_ORIGIN = ORIGIN;

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Mirror the bootstrap configuration in main.ts.
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await new Argon2PasswordHasher().hash(password),
      },
    });
    userId = user.id;
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

  function login(
    submittedEmail: string,
    submittedPassword: string,
    origin = ORIGIN,
  ) {
    return request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', origin)
      .send({ email: submittedEmail, password: submittedPassword });
  }

  function setCookies(response: {
    headers: Record<string, unknown>;
  }): string[] {
    const header = response.headers['set-cookie'];

    if (Array.isArray(header)) {
      return header as string[];
    }

    return typeof header === 'string' ? [header] : [];
  }

  function sessionCookie(response: {
    headers: Record<string, unknown>;
  }): string {
    const prefix = `${sessionCookieName()}=`;
    const cookie = setCookies(response).find((value) =>
      value.startsWith(prefix),
    );

    if (!cookie) {
      throw new Error('session cookie was not set');
    }

    return cookie.slice(0, cookie.indexOf(';'));
  }

  it('logs in, reads the current user, and invalidates the session on logout', async () => {
    const loginResponse = await login(email, password).expect(200);

    expect(loginResponse.body).toEqual({ id: userId, email });

    const cookie = sessionCookie(loginResponse);
    expect(cookie).toMatch(
      new RegExp(`^${sessionCookieName()}=[A-Za-z0-9_-]{43}$`),
    );

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);

    expect(me.body).toEqual({ id: userId, email });

    const logout = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .expect(204);

    const cleared = setCookies(logout).find((value) =>
      value.startsWith(`${sessionCookieName()}=;`),
    );
    expect(cleared).toContain('Max-Age=0');

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('rejects an invalid password with the generic response', async () => {
    const response = await login(email, 'wrong-password').expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'Invalid credentials',
    });
    expect(setCookies(response)).toHaveLength(0);
  });

  it('returns the same generic response for an unknown email', async () => {
    const wrongPassword = await login(email, 'wrong-password').expect(401);
    const unknownEmail = await login(
      `missing-${randomUUID()}@example.com`,
      password,
    ).expect(401);

    expect(unknownEmail.body).toEqual(wrongPassword.body);
    expect(setCookies(unknownEmail)).toHaveLength(0);
  });

  it('rejects an expired session and removes it lazily', async () => {
    const sessionTokens = new SessionTokenService();
    const token = sessionTokens.generate();
    const tokenHash = sessionTokens.hash(token);

    await prisma.session.create({
      data: {
        userId: userId!,
        tokenHash,
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `${sessionCookieName()}=${token}`)
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'Authentication required',
    });
    await expect(
      prisma.session.findUnique({ where: { tokenHash } }),
    ).resolves.toBeNull();
  });

  it('rejects a mutating request with an invalid origin', async () => {
    const wrongOrigin = await login(
      email,
      password,
      'http://evil.example',
    ).expect(403);

    expect(wrongOrigin.body).toMatchObject({
      statusCode: 403,
      message: 'Invalid origin',
    });
    expect(setCookies(wrongOrigin)).toHaveLength(0);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(403);
  });

  it('blocks login attempts above the rate limit', async () => {
    const rateLimitedEmail = `rate-limit-${randomUUID()}@example.com`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await login(rateLimitedEmail, 'wrong-password').expect(401);
    }

    const blocked = await login(rateLimitedEmail, 'wrong-password').expect(429);

    expect(blocked.body).toEqual({
      statusCode: 429,
      message: 'Too Many Requests',
    });
  });
});
