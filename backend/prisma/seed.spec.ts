import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { MockInstance } from 'vitest';
import { normalizeEmail } from '../src/shared/text/normalize-email.js';
import { Argon2PasswordHasher } from '../src/modules/auth/infrastructure/argon2-password-hasher.js';
import { PrismaService } from '../src/shared/database/prisma.service.js';
import { seedAdministrativeUser } from './seed-administrative-user.js';

describe('administrative user seed', () => {
  let prisma: PrismaService;
  let connectionString: string;
  let seededEmails: string[];
  let logSpy: MockInstance<typeof console.log>;

  beforeAll(async () => {
    connectionString = process.env.DATABASE_URL ?? '';

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    prisma = new PrismaService();
    await prisma.$connect();
  });

  beforeEach(() => {
    seededEmails = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    logSpy.mockRestore();
    await prisma.user.deleteMany({
      where: { email: { in: seededEmails } },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seed(email: string, password: string): Promise<void> {
    seededEmails.push(normalizeEmail(email));
    await seedAdministrativeUser({ email, password, connectionString });
  }

  it('creates the administrative user with a normalized email and an Argon2id hash', async () => {
    const email = `  Seed-${randomUUID()}@Example.COM `;
    const password = randomUUID();

    await seed(email, password);

    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });

    expect(user).not.toBeNull();
    expect(user!.email).toBe(normalizeEmail(email));
    expect(user!.passwordHash).not.toBe(password);
    expect(user!.passwordHash).not.toContain(password);
    await expect(
      new Argon2PasswordHasher().verify(user!.passwordHash, password),
    ).resolves.toBe(true);

    const logged = logSpy.mock.calls
      .map((call) => call.map(String).join(' '))
      .join('\n');
    expect(logged).toContain('Administrative user ready');
    expect(logged).not.toContain(password);
  });

  it('can run repeatedly without duplicating the administrative user', async () => {
    const email = `seed-${randomUUID()}@example.com`;
    const password = randomUUID();

    await seed(email, password);
    const first = await prisma.user.findUnique({ where: { email } });

    await seed(email, password);
    const users = await prisma.user.findMany({ where: { email } });

    expect(users).toHaveLength(1);
    expect(users[0].id).toBe(first!.id);
  });

  it('does not rotate the password when rerun with a different one', async () => {
    const email = `seed-${randomUUID()}@example.com`;
    const originalPassword = randomUUID();

    await seed(email, originalPassword);
    const first = await prisma.user.findUnique({ where: { email } });

    await seed(email, randomUUID());
    const second = await prisma.user.findUnique({ where: { email } });

    expect(second!.id).toBe(first!.id);
    expect(second!.passwordHash).toBe(first!.passwordHash);
    await expect(
      new Argon2PasswordHasher().verify(second!.passwordHash, originalPassword),
    ).resolves.toBe(true);
  });
});
