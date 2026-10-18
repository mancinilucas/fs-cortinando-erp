import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { LoginUseCase } from '../application/login.use-case.js';
import { PasswordHasher } from '../application/password-hasher.js';
import { SessionRecord, SessionStore } from '../application/session-store.js';
import { SessionTokenService } from '../application/session-token.service.js';
import {
  UserIdentity,
  UserRecord,
  UserStore,
} from '../application/user-store.js';
import { AuthController } from './auth.controller.js';

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

  async findById(): Promise<UserIdentity | null> {
    return null;
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

  async create(userId: string, tokenHash: string): Promise<SessionRecord> {
    this.created.push({ userId, tokenHash });
    return { id: 'session-id', userId, expiresAt: new Date() };
  }

  async findValidByTokenHash(): Promise<SessionRecord | null> {
    return null;
  }

  async deleteByTokenHash(): Promise<void> {}
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

describe('POST /auth/login (HTTP)', () => {
  let app: INestApplication<App>;
  let users: FakeUserStore;
  let sessions: FakeSessionStore;

  beforeEach(async () => {
    users = new FakeUserStore(USER);
    sessions = new FakeSessionStore();

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        LoginUseCase,
        SessionTokenService,
        { provide: UserStore, useValue: users },
        { provide: PasswordHasher, useValue: new FakePasswordHasher() },
        { provide: SessionStore, useValue: sessions },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

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
    expect(cookie).toContain('Max-Age=43200');
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
});
