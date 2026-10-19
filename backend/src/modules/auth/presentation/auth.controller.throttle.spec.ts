import { INestApplication, Logger } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { LoggingThrottlerGuard } from '../../../shared/http/logging-throttler.guard.js';
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
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { LOGIN_THROTTLER_OPTIONS } from './login-throttler.js';

const WINDOW_MS = 500;
const LOGIN_LIMIT = 5;
// Smaller than the production IP limit (60) so the tests stay fast; the
// behavior under test is the same.
const IP_LIMIT = 8;

class FakeUserStore extends UserStore {
  async findByEmail(email: string): Promise<UserRecord | null> {
    if (email !== 'admin@example.com') {
      return null;
    }

    return { id: 'user-id', email, passwordHash: 'stored-password-hash' };
  }

  async findById(): Promise<UserIdentity | null> {
    return null;
  }
}

class FakePasswordHasher extends PasswordHasher {
  async hash(): Promise<string> {
    return 'unused';
  }

  async verify(): Promise<boolean> {
    return false;
  }
}

class FakeSessionStore extends SessionStore {
  async create(): Promise<SessionRecord> {
    throw new Error('not used');
  }

  async findValidByTokenHash(): Promise<SessionRecord | null> {
    return null;
  }

  async deleteByTokenHash(): Promise<void> {}
}

describe('POST /auth/login rate limiting (HTTP)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          { ttl: WINDOW_MS, limit: IP_LIMIT },
          { ...LOGIN_THROTTLER_OPTIONS, ttl: WINDOW_MS },
        ]),
      ],
      controllers: [AuthController],
      providers: [
        LoginUseCase,
        LogoutUseCase,
        SessionTokenService,
        AuthGuard,
        { provide: APP_GUARD, useClass: LoggingThrottlerGuard },
        { provide: UserStore, useValue: new FakeUserStore() },
        { provide: PasswordHasher, useValue: new FakePasswordHasher() },
        { provide: SessionStore, useValue: new FakeSessionStore() },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // Test-only: supertest requests share 127.0.0.1, so one trusted proxy hop
    // lets X-Forwarded-For simulate distinct clients. Production trust proxy
    // remains deferred (DEPLOY-SEC-01).
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  function attempt(email = 'admin@example.com', ip?: string) {
    const requestBuilder = request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' });

    return ip === undefined
      ? requestBuilder
      : requestBuilder.set('X-Forwarded-For', ip);
  }

  it('returns 429 after five attempts for the same ip and email', async () => {
    const ip = '203.0.113.10';

    for (let index = 0; index < LOGIN_LIMIT; index += 1) {
      await attempt('admin@example.com', ip).expect(401);
    }

    const blocked = await attempt('admin@example.com', ip).expect(429);

    expect(blocked.body).toEqual({
      statusCode: 429,
      message: 'Too Many Requests',
    });
  });

  it('logs a blocked attempt without credentials', async () => {
    const warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    const ip = '203.0.113.20';

    try {
      for (let index = 0; index < LOGIN_LIMIT; index += 1) {
        await attempt('admin@example.com', ip).expect(401);
      }
      await attempt('admin@example.com', ip).expect(429);

      const logged = warnSpy.mock.calls
        .map((call) => call.map(String).join(' '))
        .filter((message) => message.startsWith('event=rate_limited'))
        .join('\n');

      expect(logged).toContain('event=rate_limited');
      expect(logged).toContain('method=POST');
      expect(logged).toContain('path=/auth/login');
      expect(logged).toContain(`limit=${LOGIN_LIMIT}`);
      expect(logged).not.toContain('wrong-password');
      expect(logged).not.toContain('admin@example.com');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('recovers after the window elapses', async () => {
    const ip = '203.0.113.30';

    for (let index = 0; index < LOGIN_LIMIT; index += 1) {
      await attempt('admin@example.com', ip).expect(401);
    }
    await attempt('admin@example.com', ip).expect(429);

    await new Promise((resolve) => setTimeout(resolve, WINDOW_MS + 50));

    await attempt('admin@example.com', ip).expect(401);
  });

  it('tracks different emails separately', async () => {
    const ip = '203.0.113.40';

    for (let index = 0; index < LOGIN_LIMIT; index += 1) {
      await attempt('admin@example.com', ip).expect(401);
    }
    await attempt('admin@example.com', ip).expect(429);

    await attempt('other@example.com', ip).expect(401);
  });

  it('blocks the same ip when the client varies the email', async () => {
    const ip = '203.0.113.50';

    // Fill the first email's bucket (5 requests, also 5 of the 8 IP requests).
    for (let index = 0; index < LOGIN_LIMIT; index += 1) {
      await attempt('first@example.com', ip).expect(401);
    }

    // Three more requests with a second email stay below its own limit and
    // reach the IP ceiling (5 + 3 = 8).
    for (let index = 0; index < 3; index += 1) {
      await attempt('second@example.com', ip).expect(401);
    }

    // The second email has only four attempts, so this 429 can only come from
    // the global IP limit.
    const blocked = await attempt('second@example.com', ip).expect(429);

    expect(blocked.body).toEqual({
      statusCode: 429,
      message: 'Too Many Requests',
    });
  });

  it('tracks different ips separately', async () => {
    const firstIp = '203.0.113.60';
    const secondIp = '203.0.113.61';

    for (let index = 0; index < LOGIN_LIMIT; index += 1) {
      await attempt('admin@example.com', firstIp).expect(401);
    }
    await attempt('admin@example.com', firstIp).expect(429);

    await attempt('admin@example.com', secondIp).expect(401);
  });

  it('returns the same rate limit response for an existing and an unknown email', async () => {
    const knownIp = '203.0.113.70';
    const unknownIp = '203.0.113.71';

    for (let index = 0; index < LOGIN_LIMIT; index += 1) {
      await attempt('admin@example.com', knownIp).expect(401);
    }
    const known = await attempt('admin@example.com', knownIp).expect(429);

    for (let index = 0; index < LOGIN_LIMIT; index += 1) {
      await attempt('missing@example.com', unknownIp).expect(401);
    }
    const unknown = await attempt('missing@example.com', unknownIp).expect(429);

    expect(known.body).toEqual(unknown.body);
    expect(known.body).toEqual({
      statusCode: 429,
      message: 'Too Many Requests',
    });
  });

  it('applies the global ip limit to other routes', async () => {
    const ip = '203.0.113.80';

    for (let index = 0; index < IP_LIMIT; index += 1) {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('X-Forwarded-For', ip)
        .expect(401);
    }

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('X-Forwarded-For', ip)
      .expect(429);
  });
});
