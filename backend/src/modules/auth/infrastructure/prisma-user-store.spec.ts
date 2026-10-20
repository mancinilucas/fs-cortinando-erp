import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { normalizeEmail } from '../../../shared/text/normalize-email.js';
import { Argon2PasswordHasher } from './argon2-password-hasher.js';
import { PrismaUserStore } from './prisma-user-store.js';

describe('PrismaUserStore', () => {
  const hasher = new Argon2PasswordHasher();
  const password = 'integration-password';
  const email = normalizeEmail(`  User-${randomUUID()}@Example.COM `);

  let prisma: PrismaService;
  let store: PrismaUserStore;
  let userId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    store = new PrismaUserStore(prisma);

    const user = await prisma.user.create({
      data: { email, passwordHash: await hasher.hash(password) },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('looks up a user by email', async () => {
    const user = await store.findByEmail(email);

    expect(user).toEqual({
      id: userId,
      email,
      passwordHash: expect.any(String),
    });
  });

  it('returns null when the email is not registered', async () => {
    await expect(
      store.findByEmail(`missing-${randomUUID()}@example.com`),
    ).resolves.toBeNull();
  });

  it('matches lookups built with the shared email normalization', async () => {
    const user = await store.findByEmail(
      normalizeEmail(`  ${email.toUpperCase()}  `),
    );

    expect(user?.id).toBe(userId);
  });

  it('exposes only the identity when looking up by id', async () => {
    const identity = await store.findById(userId);

    expect(identity).toEqual({ id: userId, email });
    expect(Object.keys(identity!)).toEqual(['id', 'email']);
  });

  it('returns null when the id is not registered', async () => {
    await expect(store.findById(randomUUID())).resolves.toBeNull();
  });

  it('persists an Argon2id hash that verifies the original password', async () => {
    const user = await store.findByEmail(email);

    expect(user!.passwordHash).not.toBe(password);
    expect(user!.passwordHash).not.toContain(password);
    expect(user!.passwordHash).toMatch(/^\$argon2id\$/);
    await expect(hasher.verify(user!.passwordHash, password)).resolves.toBe(
      true,
    );
    await expect(
      hasher.verify(user!.passwordHash, 'wrong-password'),
    ).resolves.toBe(false);
  });
});
