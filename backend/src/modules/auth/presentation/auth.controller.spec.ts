import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { MockInstance } from 'vitest';
import { App } from 'supertest/types.js';
import { LoginUseCase } from '../application/login.use-case.js';
import { LogoutUseCase } from '../application/logout.use-case.js';
import { PasswordHasher } from '../application/password-hasher.js';
import { SessionRecord, SessionStore } from '../application/session-store.js';
import { SessionTokenService } from '../application/session-token.service.js';
import {
  UserIdentity,
  UserRecord,
  UserStore,
} from '../application/user-store.js';
import { SESSION_TTL_SECONDS } from '../session-ttl.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';

const USER: UserRecord = {
  id: 'user-id',
  email: 'admin@example.com',
  passwordHash: 'stored-password-hash',
};

const COOKIE_PREFIX = 'cortinando_session=';

class FakeUserStore extends UserStore {
  lastEmail: string | null = null;

  constructor(public user: UserRecord | null) {
    super();
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    this.lastEmail = email;
    return this.user;
  }

  async findById(id: string): Promise<UserIdentity | null> {
    if (!this.user || this.user.id !== id) {
      return null;
    }

    return { id: this.user.id, email: this.user.email };
  }
}

class FakePasswordHasher extends PasswordHasher {
  async hash(): Promise<string> {
    return 'unused';
  }

  async verify(_passwordHash: string, password: string): Promise<boolean> {
    return password === 'correct-password';
  }
}

class FakeSessionStore extends SessionStore {
  created: Array<{ userId: string; tokenHash: string }> = [];
  private readonly sessions = new Map<string, SessionRecord>();

  async create(userId: string, tokenHash: string): Promise<SessionRecord> {
    this.created.push({ userId, tokenHash });

    const session = {
      id: `session-${this.created.length}`,
      userId,
      expiresAt: new Date(Date.now() + 60_000),
    };
    this.sessions.set(tokenHash, session);

    return session;
  }

  async findValidByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.sessions.get(tokenHash) ?? null;
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }
}

function setCookieHeaders(response: {
  headers: Record<string, unknown>;
}): string[] {
  const header = response.headers['set-cookie'];

  if (Array.isArray(header)) {
    return header as string[];
  }

  return typeof header === 'string' ? [header] : [];
}

function sessionToken(response: { headers: Record<string, unknown> }): string {
  const cookie = setCookieHeaders(response).find((value) =>
    value.startsWith(COOKIE_PREFIX),
  );

  if (!cookie) {
    throw new Error('session cookie was not set');
  }

  return cookie.slice(COOKIE_PREFIX.length).split(';')[0];
}

describe('AuthController (HTTP)', () => {
  let app: INestApplication<App>;
  let users: FakeUserStore;
  let sessions: FakeSessionStore;
  let warnSpy: MockInstance<typeof Logger.prototype.warn>;

  beforeEach(async () => {
    warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    users = new FakeUserStore(USER);
    sessions = new FakeSessionStore();

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        LoginUseCase,
        LogoutUseCase,
        SessionTokenService,
        AuthGuard,
        { provide: UserStore, useValue: users },
        { provide: PasswordHasher, useValue: new FakePasswordHasher() },
        { provide: SessionStore, useValue: sessions },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    warnSpy.mockRestore();
    await app.close();
  });

  function warnings(): string[] {
    return warnSpy.mock.calls
      .map((call) => call[0])
      .filter((message): message is string => typeof message === 'string')
      .filter((message) => message.startsWith('event='));
  }

  async function loginCookie(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'correct-password' })
      .expect(200);

    return `${COOKIE_PREFIX}${sessionToken(response)}`;
  }

  it('returns success and emits a secure session cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'correct-password' })
      .expect(200);

    expect(response.body).toEqual({ id: USER.id, email: USER.email });

    const cookie = setCookieHeaders(response).find((value) =>
      value.startsWith(COOKIE_PREFIX),
    );

    expect(cookie).toMatch(
      /^cortinando_session=[A-Za-z0-9_-]{43};.*HttpOnly.*SameSite=Strict/,
    );
    expect(cookie).toContain(`Max-Age=${SESSION_TTL_SECONDS}`);
    expect(cookie).toContain('Path=/');
    expect(cookie).not.toContain('Secure');
  });

  it('keeps the raw token in the cookie only', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'correct-password' })
      .expect(200);

    const token = sessionToken(response);
    const tokenHash = new SessionTokenService().hash(token);

    expect(JSON.stringify(response.body)).not.toContain(token);
    expect(sessions.created).toEqual([{ userId: USER.id, tokenHash }]);
  });

  it('does not expose the password hash', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'correct-password' })
      .expect(200);

    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('returns the same generic response for a wrong password and an unknown email', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'wrong-password' })
      .expect(401);

    users.user = null;
    const unknownEmail = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'unknown@example.com', password: 'correct-password' })
      .expect(401);

    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body).toMatchObject({
      statusCode: 401,
      message: 'Invalid credentials',
    });
    expect(setCookieHeaders(wrongPassword)).toHaveLength(0);
    expect(setCookieHeaders(unknownEmail)).toHaveLength(0);
    expect(sessions.created).toHaveLength(0);

    // Unknown email and wrong password must be indistinguishable in the logs.
    const failures = warnings();
    expect(failures).toHaveLength(2);
    expect(failures[0]).toBe(failures[1]);
    expect(failures[0]).toMatch(/^event=login_failed ip=/);
    expect(failures.join('\n')).not.toContain('admin@example.com');
    expect(failures.join('\n')).not.toContain('unknown@example.com');
    expect(failures.join('\n')).not.toContain('wrong-password');
  });

  it('never writes credentials or session tokens to the logs', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'correct-password' })
      .expect(200);

    const token = sessionToken(login);
    const cookie = `${COOKIE_PREFIX}${token}`;

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'wrong-password' })
      .expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `${COOKIE_PREFIX}${'a'.repeat(43)}`)
      .expect(401);

    const logged = warnSpy.mock.calls
      .map((call) => call.map(String).join(' '))
      .join('\n');

    expect(logged).not.toContain('correct-password');
    expect(logged).not.toContain('wrong-password');
    expect(logged).not.toContain(token);
    expect(logged).not.toContain(new SessionTokenService().hash(token));
    expect(logged).not.toContain('a'.repeat(43));
  });

  it('normalizes the email before looking the user up', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: '  ADMIN@Example.COM ', password: 'correct-password' })
      .expect(200);

    expect(users.lastEmail).toBe('admin@example.com');
  });

  it('rejects an invalid payload without creating a session', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: '' })
      .expect(400);

    expect(response.body).toMatchObject({ statusCode: 400 });
    expect(sessions.created).toHaveLength(0);
    expect(setCookieHeaders(response)).toHaveLength(0);
  });

  describe('GET /auth/me', () => {
    it('returns the authenticated user for a valid session', async () => {
      const cookie = await loginCookie();

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(200);

      expect(response.body).toEqual({ id: USER.id, email: USER.email });
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('rejects a request without a session cookie', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Authentication required',
        error: 'Unauthorized',
      });
    });

    it('rejects an unknown session token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', `${COOKIE_PREFIX}${'a'.repeat(43)}`)
        .expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Authentication required',
        error: 'Unauthorized',
      });
    });
  });

  describe('POST /auth/logout', () => {
    it('removes the session, clears the cookie, and returns 204', async () => {
      const cookie = await loginCookie();

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookie)
        .expect(204);

      const clearCookie = setCookieHeaders(response).find((value) =>
        value.startsWith(COOKIE_PREFIX),
      );

      expect(clearCookie).toMatch(/^cortinando_session=;/);
      expect(clearCookie).toContain('Max-Age=0');
      expect(clearCookie).toContain('Path=/');
      expect(clearCookie).toContain('HttpOnly');
      expect(clearCookie).toContain('SameSite=Strict');
      expect(clearCookie).not.toContain('Secure');

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(401);
    });

    it('returns 204 when called again with the same cookie', async () => {
      const cookie = await loginCookie();

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookie)
        .expect(204);

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookie)
        .expect(204);
    });

    it('returns 204 and clears the cookie without a session', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .expect(204);

      expect(
        setCookieHeaders(response).some((value) =>
          value.startsWith(`${COOKIE_PREFIX};`),
        ),
      ).toBe(true);
    });

    it('returns 204 for an unknown session token', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', `${COOKIE_PREFIX}${'a'.repeat(43)}`)
        .expect(204);
    });
  });
});
