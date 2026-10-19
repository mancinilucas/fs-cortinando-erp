import { ExecutionContext, Logger } from '@nestjs/common';
import type { MockInstance } from 'vitest';
import { SessionRecord, SessionStore } from '../application/session-store.js';
import { SessionTokenService } from '../application/session-token.service.js';
import {
  UserIdentity,
  UserRecord,
  UserStore,
} from '../application/user-store.js';
import { AuthGuard, AuthenticatedRequest } from './auth.guard.js';
import { sessionCookieName } from './session-cookie.js';

const USER: UserIdentity = { id: 'user-id', email: 'admin@example.com' };

class FakeSessionStore extends SessionStore {
  lastTokenHash: string | null = null;

  constructor(private readonly session: SessionRecord | null) {
    super();
  }

  async create(): Promise<SessionRecord> {
    throw new Error('not used');
  }

  async findValidByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    this.lastTokenHash = tokenHash;
    return this.session;
  }

  async deleteByTokenHash(): Promise<void> {}
}

class FakeUserStore extends UserStore {
  constructor(private readonly user: UserIdentity | null) {
    super();
  }

  async findByEmail(): Promise<UserRecord | null> {
    return null;
  }

  async findById(): Promise<UserIdentity | null> {
    return this.user;
  }
}

const sessionTokens = new SessionTokenService();
const token = sessionTokens.generate();
const session: SessionRecord = {
  id: 'session-id',
  userId: USER.id,
  expiresAt: new Date(Date.now() + 60_000),
};

function requestWith(cookie?: string): AuthenticatedRequest {
  return {
    headers: cookie === undefined ? {} : { cookie },
  } as AuthenticatedRequest;
}

function contextFor(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function buildGuard(
  sessionResult: SessionRecord | null,
  user: UserIdentity | null = USER,
  request = requestWith(`${sessionCookieName()}=${token}`),
) {
  const sessions = new FakeSessionStore(sessionResult);

  return {
    guard: new AuthGuard(sessions, sessionTokens, new FakeUserStore(user)),
    sessions,
    request,
  };
}

describe('AuthGuard', () => {
  let warnSpy: MockInstance<typeof Logger.prototype.warn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  function warnings(): string[] {
    return warnSpy.mock.calls
      .map((call) => call[0])
      .filter((message): message is string => typeof message === 'string')
      .filter((message) => message.startsWith('event='));
  }

  it('rejects a request without a session cookie', async () => {
    const { guard, sessions, request } = buildGuard(
      session,
      USER,
      requestWith(),
    );

    await expect(guard.canActivate(contextFor(request))).rejects.toMatchObject({
      message: 'Authentication required',
    });
    expect(sessions.lastTokenHash).toBeNull();
    expect(warnings()).toEqual(['event=session_missing ip=unknown']);
  });

  it('rejects a malformed token without querying the session store', async () => {
    const { guard, sessions, request } = buildGuard(
      session,
      USER,
      requestWith(`${sessionCookieName()}=not-a-token`),
    );

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow();
    expect(sessions.lastTokenHash).toBeNull();
  });

  it('rejects an unknown token', async () => {
    const { guard, sessions, request } = buildGuard(null);

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow();
    expect(sessions.lastTokenHash).toBe(sessionTokens.hash(token));

    const logged = warnings().join('\n');
    expect(logged).toContain('event=session_invalid');
    expect(logged).not.toContain(token);
    expect(logged).not.toContain(sessionTokens.hash(token));
  });

  it('rejects a session that is no longer valid', async () => {
    const { guard, request } = buildGuard(null);

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow();
  });

  it('rejects a valid session whose user no longer exists', async () => {
    const { guard, request } = buildGuard(session, null);

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow();
    expect(request.user).toBeUndefined();
  });

  it('allows the request and exposes the authenticated identity', async () => {
    const { guard, sessions, request } = buildGuard(session);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(sessions.lastTokenHash).toBe(sessionTokens.hash(token));
    expect(request.user).toEqual(USER);
    expect(warnings()).toEqual([]);
  });
});
