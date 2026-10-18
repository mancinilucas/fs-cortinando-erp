import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
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
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';

const WINDOW_MS = 500;

class FakeUserStore extends UserStore {
  async findByEmail(): Promise<UserRecord | null> {
    return null;
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
      imports: [ThrottlerModule.forRoot([{ ttl: WINDOW_MS, limit: 60 }])],
      controllers: [AuthController],
      providers: [
        LoginUseCase,
        LogoutUseCase,
        SessionTokenService,
        AuthGuard,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: UserStore, useValue: new FakeUserStore() },
        { provide: PasswordHasher, useValue: new FakePasswordHasher() },
        { provide: SessionStore, useValue: new FakeSessionStore() },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  function attempt(email = 'admin@example.com') {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' });
  }

  it('returns 429 after five attempts for the same ip and email', async () => {
    for (let index = 0; index < 5; index += 1) {
      await attempt().expect(401);
    }

    const blocked = await attempt().expect(429);

    expect(blocked.body).toMatchObject({
      statusCode: 429,
      message: 'ThrottlerException: Too Many Requests',
    });
  });

  it('recovers after the window elapses', async () => {
    for (let index = 0; index < 5; index += 1) {
      await attempt().expect(401);
    }
    await attempt().expect(429);

    await new Promise((resolve) => setTimeout(resolve, WINDOW_MS + 50));

    await attempt().expect(401);
  });

  it('tracks different emails separately', async () => {
    for (let index = 0; index < 5; index += 1) {
      await attempt('admin@example.com').expect(401);
    }
    await attempt('admin@example.com').expect(429);

    await attempt('other@example.com').expect(401);
  });

  it('keeps the broader limit on other routes', async () => {
    for (let index = 0; index < 6; index += 1) {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    }
  });
});
