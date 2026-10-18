import { DUMMY_PASSWORD_HASH, LoginUseCase } from './login.use-case.js';
import { PasswordHasher } from './password-hasher.js';
import { SessionRecord, SessionStore } from './session-store.js';
import { SessionTokenService } from './session-token.service.js';
import { UserRecord, UserStore } from './user-store.js';

const USER: UserRecord = {
  id: 'user-id',
  email: 'admin@example.com',
  passwordHash: 'stored-password-hash',
};

class FakeUserStore extends UserStore {
  lastEmail: string | null = null;

  constructor(private readonly user: UserRecord | null) {
    super();
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    this.lastEmail = email;
    return this.user;
  }
}

class FakePasswordHasher extends PasswordHasher {
  calls: Array<{ passwordHash: string; password: string }> = [];

  async hash(): Promise<string> {
    return 'unused';
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    this.calls.push({ passwordHash, password });
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

describe('LoginUseCase', () => {
  let users: FakeUserStore;
  let passwordHasher: FakePasswordHasher;
  let sessions: FakeSessionStore;
  let useCase: LoginUseCase;

  beforeEach(() => {
    users = new FakeUserStore(USER);
    passwordHasher = new FakePasswordHasher();
    sessions = new FakeSessionStore();
    useCase = new LoginUseCase(
      users,
      passwordHasher,
      new SessionTokenService(),
      sessions,
    );
  });

  it('returns a session token and the authenticated user', async () => {
    const result = await useCase.execute({
      email: 'admin@example.com',
      password: 'correct-password',
    });

    expect(result).toMatchObject({
      user: { id: USER.id, email: USER.email },
    });
    expect(result?.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('normalizes the email before looking the user up', async () => {
    await useCase.execute({
      email: '  ADMIN@Example.COM ',
      password: 'correct-password',
    });

    expect(users.lastEmail).toBe('admin@example.com');
  });

  it('verifies the password against the persisted hash', async () => {
    await useCase.execute({
      email: 'admin@example.com',
      password: 'correct-password',
    });

    expect(passwordHasher.calls).toEqual([
      { passwordHash: USER.passwordHash, password: 'correct-password' },
    ]);
  });

  it('persists only the hash of the generated token', async () => {
    const result = await useCase.execute({
      email: 'admin@example.com',
      password: 'correct-password',
    });

    const token = result?.token as string;
    const expectedHash = new SessionTokenService().hash(token);

    expect(sessions.created).toEqual([
      { userId: USER.id, tokenHash: expectedHash },
    ]);
    expect(sessions.created[0].tokenHash).not.toBe(token);
    expect(sessions.created[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a wrong password without creating a session', async () => {
    const result = await useCase.execute({
      email: 'admin@example.com',
      password: 'wrong-password',
    });

    expect(result).toBeNull();
    expect(passwordHasher.calls).toHaveLength(1);
    expect(sessions.created).toHaveLength(0);
  });

  it('verifies the dummy hash when the email does not exist', async () => {
    users = new FakeUserStore(null);
    useCase = new LoginUseCase(
      users,
      passwordHasher,
      new SessionTokenService(),
      sessions,
    );

    const result = await useCase.execute({
      email: 'unknown@example.com',
      password: 'correct-password',
    });

    expect(result).toBeNull();
    expect(passwordHasher.calls).toEqual([
      { passwordHash: DUMMY_PASSWORD_HASH, password: 'correct-password' },
    ]);
    expect(sessions.created).toHaveLength(0);
  });
});
